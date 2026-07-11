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

async function getSession(contactId) {
  const res = await fetch(`${REST}/flow_sessions?contact_id=eq.${contactId}&select=*&limit=1`, { headers: H })
  const rows = await res.json()
  if (!rows[0]) return null
  return { flowId: rows[0].flow_id, currentNode: rows[0].current_node, status: rows[0].status, updatedAt: rows[0].updated_at }
}

async function saveSession(contactId, state) {
  await fetch(`${REST}/flow_sessions?on_conflict=contact_id`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: state.flowId || null,
      current_node: state.currentNode,
      status: state.status,
      updated_at: new Date().toISOString(),
    }),
  })
}

// Busca as configurações (liga/desliga, horário, delays) no painel.
async function getSettings() {
  const res = await fetch(`${PAINEL_URL}/api/settings`)
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

async function callBot(state, input, startFlowId = null) {
  const res = await fetch(`${PAINEL_URL}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, input, startFlowId }),
  })
  if (!res.ok) throw new Error(`bot ${res.status}`)
  return res.json() // { replies: [{text}], state }
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
async function handleIncoming(contactId, text, opts = {}) {
  const { reengageHours = 12, isMedia = false, defaultFlowId = null, mediaFlowId = null } =
    typeof opts === 'number' ? { reengageHours: opts } : opts

  const session = await getSession(contactId)
  const age = session && session.updatedAt ? Date.now() - Date.parse(session.updatedAt) : Infinity
  const stale = age > reengageHours * 3600 * 1000

  // Anexo de mídia → fluxo padrão de mídia (se configurado). Não interrompe um
  // fluxo ativo que esteja aguardando (aí a mídia é tratada como resposta).
  if (isMedia && mediaFlowId && (!session || session.status !== 'active')) {
    const result = await callBot(null, text, mediaFlowId)
    await saveSession(contactId, result.state)
    return result
  }

  // Sem sessão OU voltou depois de muito tempo → boas-vindas (menu).
  if (!session || stale) {
    const result = await callBot(null, text)
    await saveSession(contactId, result.state)
    return result
  }

  // Concluído há pouco tempo → 2º contato: roda o fluxo de resposta padrão
  // (que normalmente só abre o atendimento). Sem ele, apenas reabre em silêncio.
  if (session.status === 'done') {
    if (defaultFlowId) {
      const result = await callBot(null, text, defaultFlowId)
      await saveSession(contactId, result.state)
      return result
    }
    await saveSession(contactId, { flowId: session.flowId, currentNode: null, status: 'handoff' })
    return { replies: [] }
  }

  // Atendente humano no comando → bot quieto (mantém a conversa aberta/recente).
  if (session.status === 'handoff') {
    await saveSession(contactId, { flowId: session.flowId, currentNode: session.currentNode, status: 'handoff' })
    return { replies: [] }
  }

  // Fluxo ativo → avança.
  const result = await callBot(session, text)

  // Limite de 2 erros num menu: se o paciente responde algo inválido 2x, o bot
  // FICA QUIETO (status atendimento) — o atendente que já acompanha assume, sem
  // mensagem de "vou transferir". 1º erro ainda manda o lembrete curto.
  if (result.invalid) {
    const n = (invalidCount.get(contactId) || 0) + 1
    if (n >= 2) {
      invalidCount.delete(contactId)
      await saveSession(contactId, { flowId: result.state.flowId, currentNode: result.state.currentNode, status: 'handoff' })
      return { replies: [] } // sem repetir, sem "transferindo" — atendente assume
    }
    invalidCount.set(contactId, n)
    await saveSession(contactId, result.state)
    return result
  }

  invalidCount.delete(contactId) // resposta válida → zera o contador
  await saveSession(contactId, result.state)
  return result
}

module.exports = { handleIncoming, getSettings, isWithinHours }
