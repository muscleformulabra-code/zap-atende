// Liga o conector (WhatsApp) ao motor do chatbot (que roda no painel).
// A cada mensagem recebida: descobre em que ponto do fluxo o contato está,
// pede as respostas ao painel (/api/simulate) e devolve pra enviar no WhatsApp.
const PAINEL_URL = process.env.PAINEL_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
const REST = `${SUPABASE_URL}/rest/v1`
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

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

async function callBot(state, input) {
  const res = await fetch(`${PAINEL_URL}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, input }),
  })
  if (!res.ok) throw new Error(`bot ${res.status}`)
  return res.json() // { replies: [{text}], state }
}

// Processa uma mensagem recebida e devolve as respostas do bot.
// - Se o contato já está com atendente (handoff) recente, o bot fica quieto.
// - Se o paciente volta depois de `reengageHours` de inatividade, o fluxo REINICIA.
async function handleIncoming(contactId, text, reengageHours = 12) {
  const session = await getSession(contactId)
  const stale =
    session && session.updatedAt && Date.now() - Date.parse(session.updatedAt) > reengageHours * 3600 * 1000

  // Humano atendendo (handoff) e ainda recente → bot não interfere.
  if (session && session.status === 'handoff' && !stale) return { replies: [] }

  const isNew = !session || session.status === 'done' || stale
  const result = await callBot(isNew ? null : session, text)
  await saveSession(contactId, result.state)
  return result
}

module.exports = { handleIncoming, getSettings, isWithinHours }
