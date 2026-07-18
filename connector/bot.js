// Liga o conector (WhatsApp) ao motor do chatbot (que roda no painel).
// A cada mensagem recebida: descobre em que ponto do fluxo o contato está,
// pede as respostas ao painel (/api/simulate) e devolve pra enviar no WhatsApp.
const PAINEL_URL = process.env.PAINEL_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
const REST = `${SUPABASE_URL}/rest/v1`
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// Conta respostas inválidas por contato num menu (na memória; zera no restart).
const invalidCount = new Map()

// BLINDAGEM ANTI-SPAM: guarda quando cada contato recebeu as BOAS-VINDAS.
// Se o menu de boas-vindas for disparar de novo pra alguém que acabou de
// recebê-lo, o bot fica QUIETO. Mata o "menu toda hora pro paciente".
const lastWelcomeAt = new Map()
const WELCOME_COOLDOWN_MS = 5 * 60 * 1000 // 5 min

async function getSession(contactId) {
  const res = await fetch(`${REST}/flow_sessions?contact_id=eq.${contactId}&select=*&limit=1`, { headers: H })
  const rows = await res.json()
  if (!rows[0]) return null
  return { flowId: rows[0].flow_id, currentNode: rows[0].current_node, status: rows[0].status, updatedAt: rows[0].updated_at }
}

const SEED_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

async function saveSession(contactId, state, companyId) {
  await fetch(`${REST}/flow_sessions?on_conflict=contact_id`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: state.flowId || null,
      current_node: state.currentNode,
      status: state.status,
      company_id: companyId || SEED_COMPANY_ID,
      updated_at: new Date().toISOString(),
    }),
  })
}

// Busca as configurações (liga/desliga, horário, delays) da EMPRESA no painel.
async function getSettings(companyId) {
  const q = companyId ? `?company=${companyId}` : ''
  const res = await fetch(`${PAINEL_URL}/api/settings${q}`)
  if (!res.ok) throw new Error(`settings ${res.status}`)
  return res.json()
}

// Está dentro do horário de atendimento? (fuso de Brasília)
function isWithinHours(hours) {
  if (!hours || !Array.isArray(hours.days)) return true
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(new Date())
  const wd = parts.find((p) => p.type === 'weekday').value
  const hh = parts.find((p) => p.type === 'hour').value
  const mm = parts.find((p) => p.type === 'minute').value
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const day = map[wd]
  const hhmm = `${hh === '24' ? '00' : hh}:${mm}`
  if (!hours.days.includes(day)) return false
  return hhmm >= (hours.start || '00:00') && hhmm <= (hours.end || '23:59')
}

async function callBot(state, input, startFlowId = null, companyId = null) {
  const res = await fetch(`${PAINEL_URL}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, input, startFlowId, company: companyId, track: true }),
  })
  if (!res.ok) throw new Error(`bot ${res.status}`)
  return res.json() // { replies: [{text}], state }
}

// Chama a IA (Sofia) no painel. Devolve { enabled, message, handoff, reason }.
async function callAiReply(contactId, companyId) {
  try {
    const res = await fetch(`${PAINEL_URL}/api/ai-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, company: companyId }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Processa uma mensagem recebida e devolve as respostas do bot.
// Regras (iguais ao BotConversa):
//  - Sem sessão OU voltou depois de MUITO tempo (reengageHours) → fluxo de
//    BOAS-VINDAS (pré-atendimento, com menu). É o "1º contato / faz tempo".
//  - Concluído há POUCO tempo → "2º contato": só REABRE pro atendente, SEM
//    repetir o menu (anti-spam, evita ban).
//  - Em atendimento humano (handoff) → bot fica quieto, conversa continua aberta.
//  - Fluxo ativo → avança normalmente.
// Em TODOS os casos de mensagem nova, a conversa deixa de ficar "concluída"
// (reabre) — quem estava done vira handoff/ativo.
// opts: { reengageHours, isMedia, defaultFlowId, mediaFlowId }
//  - Fluxo de boas-vindas = fluxo is_active (usado no 1º contato / faz tempo).
//  - Fluxo padrão de mídia (mediaFlowId) = quando o paciente manda anexo.
//  - Fluxo de resposta padrão (defaultFlowId) = quando um contato já concluído
//    volta a escrever (o "2º contato").
// Normaliza a frase (minúsculo, sem pontuação final, espaços colapsados) pra
// casar a mensagem do paciente com a frase da campanha.
function normPhrase(s) { return (s || '').toLowerCase().trim().replace(/[.!?…]+$/g, '').replace(/\s+/g, ' ') }

// A mensagem é EXATAMENTE a frase de alguma campanha? (tráfego pago → fluxo)
async function matchCampaign(companyId, text) {
  const norm = normPhrase(text)
  if (!norm) return null
  try {
    const res = await fetch(`${REST}/campaigns?company_id=eq.${companyId || SEED_COMPANY_ID}&flow_id=not.is.null&select=id,flow_id,phrase`, { headers: H })
    const rows = await res.json()
    return rows.find((c) => normPhrase(c.phrase) === norm) || null
  } catch {
    return null
  }
}

async function bumpCampaign(id) {
  try {
    await fetch(`${REST}/rpc/increment_campaign_metric`, { method: 'POST', headers: H, body: JSON.stringify({ p_id: id, p_part: 1, p_exec: 1 }) })
  } catch {}
}

async function handleIncoming(contactId, text, opts = {}) {
  const { reengageHours = 12, isMedia = false, defaultFlowId = null, mediaFlowId = null, companyId = null, aiEnabled = false } =
    typeof opts === 'number' ? { reengageHours: opts } : opts

  // CAMPANHA (tráfego pago): se a mensagem é a frase exata de uma campanha,
  // dispara o FLUXO dela direto (pula o menu) e conta o lead.
  const camp = await matchCampaign(companyId, text)
  if (camp) {
    const result = await callBot(null, text, camp.flow_id, companyId)
    await saveSession(contactId, result.state, companyId)
    bumpCampaign(camp.id)
    return result
  }

  const session = await getSession(contactId)

  // ── MODO IA (ex.: Ricco Odonto): a Sofia responde de ponta a ponta. ──
  // Só para quando o atendente humano já assumiu (handoff). Se a IA decidir
  // passar pro humano (dados de agendamento ou assunto sensível), marca handoff.
  if (aiEnabled) {
    if (session && session.status === 'handoff') {
      await saveSession(contactId, { flowId: session.flowId || null, currentNode: session.currentNode || 'ai', status: 'handoff' }, companyId)
      return { replies: [] } // humano no comando → bot quieto
    }
    const ai = await callAiReply(contactId, companyId)
    if (ai && ai.enabled) {
      await saveSession(contactId, { flowId: null, currentNode: 'ai', status: ai.handoff ? 'handoff' : 'active' }, companyId)
      return { replies: ai.message ? [{ text: ai.message }] : [] }
    }
    // IA indisponível → passa pro humano (não deixa o paciente sem resposta).
    await saveSession(contactId, { flowId: null, currentNode: 'ai', status: 'handoff' }, companyId)
    return { replies: [] }
  }

  const age = session && session.updatedAt ? Date.now() - Date.parse(session.updatedAt) : Infinity
  const stale = age > reengageHours * 3600 * 1000

  // Anexo de mídia → fluxo padrão de mídia (se configurado). Não interrompe um
  // fluxo ativo que esteja aguardando (aí a mídia é tratada como resposta).
  if (isMedia && mediaFlowId && (!session || session.status !== 'active')) {
    const result = await callBot(null, text, mediaFlowId, companyId)
    await saveSession(contactId, result.state, companyId)
    return result
  }

  // Sem sessão OU voltou depois de muito tempo → boas-vindas (menu).
  if (!session || stale) {
    // BLINDAGEM: se acabou de mandar boas-vindas pra esse contato, NÃO repete.
    // Evita o "menu toda hora" mesmo se a sessão vier bagunçada por qualquer
    // motivo. Fica quieto e deixa o atendente/próxima mensagem seguir.
    const last = lastWelcomeAt.get(contactId) || 0
    if (Date.now() - last < WELCOME_COOLDOWN_MS) return { replies: [] }
    lastWelcomeAt.set(contactId, Date.now())
    const result = await callBot(null, text, null, companyId)
    await saveSession(contactId, result.state, companyId)
    return result
  }

  // Concluído há pouco tempo → 2º contato: roda o fluxo de resposta padrão
  // (que normalmente só abre o atendimento). Sem ele, apenas reabre em silêncio.
  if (session.status === 'done') {
    if (defaultFlowId) {
      const result = await callBot(null, text, defaultFlowId, companyId)
      await saveSession(contactId, result.state, companyId)
      return result
    }
    await saveSession(contactId, { flowId: session.flowId, currentNode: null, status: 'handoff' }, companyId)
    return { replies: [] }
  }

  // Atendente humano no comando → bot quieto (mantém a conversa aberta/recente).
  if (session.status === 'handoff') {
    await saveSession(contactId, { flowId: session.flowId, currentNode: session.currentNode, status: 'handoff' }, companyId)
    return { replies: [] }
  }

  // Fluxo ativo → avança.
  const result = await callBot(session, text, null, companyId)

  // Limite de 2 erros num menu: se o paciente responde algo inválido 2x, o bot
  // FICA QUIETO (status atendimento) — o atendente que já acompanha assume, sem
  // mensagem de "vou transferir". 1º erro ainda manda o lembrete curto.
  if (result.invalid) {
    const n = (invalidCount.get(contactId) || 0) + 1
    if (n >= 2) {
      invalidCount.delete(contactId)
      await saveSession(contactId, { flowId: result.state.flowId, currentNode: result.state.currentNode, status: 'handoff' }, companyId)
      return { replies: [] } // sem repetir, sem "transferindo" — atendente assume
    }
    invalidCount.set(contactId, n)
    await saveSession(contactId, result.state, companyId)
    return result
  }

  invalidCount.delete(contactId) // resposta válida → zera o contador
  await saveSession(contactId, result.state, companyId)
  return result
}

module.exports = { handleIncoming, getSettings, isWithinHours }
