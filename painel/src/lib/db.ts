// Camada de dados: conversa com o Supabase via REST (PostgREST).
// Usada só no servidor (server components) — a service key nunca vai pro navegador.

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')
}

const REST = `${SUPABASE_URL}/rest/v1`
const authHeaders = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${REST}/${path}`, {
    ...init,
    headers: { ...authHeaders, ...(init.headers ?? {}) },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status}: ${await res.text()}`)
  return res
}

// Conta linhas de uma query (usa o header content-range do PostgREST).
async function count(path: string): Promise<number> {
  const res = await rest(path, { method: 'HEAD', headers: { Prefer: 'count=exact' } })
  const range = res.headers.get('content-range') // ex: "0-24/25" ou "*/25"
  const total = range?.split('/')[1]
  return Number(total) || 0
}

export type Conversation = {
  contact_id: string
  jid: string
  phone: string | null
  name: string | null
  created_at: string
  last_text: string | null
  last_from_me: boolean | null
  last_sent_at: string | null
  status: string
}

export async function getConversations(): Promise<Conversation[]> {
  const [convs, sessions] = await Promise.all([
    (await rest('conversations?select=*&order=last_sent_at.desc.nullslast&limit=100')).json(),
    (await rest('flow_sessions?select=contact_id,status')).json(),
  ])
  const smap = new Map<string, string>((sessions as { contact_id: string; status: string }[]).map((s) => [s.contact_id, s.status]))
  return (convs as Omit<Conversation, 'status'>[]).map((c) => ({ ...c, status: smap.get(c.contact_id) ?? 'active' }))
}

export type Message = {
  id: string
  from_me: boolean
  text: string | null
  sent_at: string | null
}

export async function getMessages(contactId: string): Promise<Message[]> {
  const res = await rest(
    `messages?contact_id=eq.${contactId}&select=id,from_me,text,sent_at&order=sent_at.asc&limit=300`
  )
  return res.json()
}

export async function getContactJid(contactId: string): Promise<string | null> {
  const res = await rest(`contacts?id=eq.${contactId}&select=jid`)
  const rows = await res.json()
  return rows[0]?.jid ?? null
}

// ── Respostas rápidas (mensagens prontas /atalho) ──
export type QuickReply = { id: string; shortcut: string; text: string }

export async function listQuickReplies(): Promise<QuickReply[]> {
  try {
    const res = await rest('quick_replies?select=id,shortcut,text&order=shortcut.asc')
    return res.json()
  } catch {
    return [] // tabela ainda não criada
  }
}

export async function createQuickReply(shortcut: string, text: string): Promise<void> {
  await rest('quick_replies', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ shortcut, text }),
  })
}

export async function deleteQuickReply(id: string): Promise<void> {
  await rest(`quick_replies?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// Marca a sessão do contato como handoff (bot para de responder).
export async function setHandoff(contactId: string): Promise<void> {
  await setSessionStatus(contactId, 'handoff')
}

// Marca o atendimento como concluído (entra na métrica de "concluídas").
export async function setDone(contactId: string): Promise<void> {
  await setSessionStatus(contactId, 'done')
}

// Reabre o atendimento (bot pausado, atendente conduz).
export async function reopen(contactId: string): Promise<void> {
  await setSessionStatus(contactId, 'handoff')
}

// Muda o status pra qualquer valor válido (usado pela ficha do lead no inbox).
export async function setStatus(contactId: string, status: string): Promise<void> {
  await setSessionStatus(contactId, status)
}

async function setSessionStatus(contactId: string, status: string): Promise<void> {
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ contact_id: contactId, status, updated_at: new Date().toISOString() }),
  })
}

// Ficha do lead: dados do contato + status do atendimento (pro painel do inbox).
export type ContactCard = {
  id: string
  name: string | null
  phone: string | null
  jid: string
  created_at: string
  status: string
}

export async function getContactCard(contactId: string): Promise<ContactCard | null> {
  const rows = await (await rest(`contacts?id=eq.${contactId}&select=id,name,phone,jid,created_at`)).json()
  const contact = rows[0]
  if (!contact) return null
  const sess = await (await rest(`flow_sessions?contact_id=eq.${contactId}&select=status`)).json()
  return { ...contact, status: sess[0]?.status ?? 'active' }
}

export type Stats = {
  totalContatos: number
  leadsHoje: number
  aguardando: number
  msgsHoje: number
}

export type Analytics = {
  leadsPeriodo: number
  leadsTotal: number
  emAberto: number
  fechadas: number
  emAtendimento: number
  recebidas: number
  enviadas: number
  tempoMedioRespMin: number | null
  ranking: { atendente: string; respostas: number }[]
}

// Análise completa por período [fromISO, toISO).
export async function getAnalytics(fromISO: string, toISO: string): Promise<Analytics> {
  const [leadsTotal, leadsPeriodo, emAberto, fechadas, emAtendimento] = await Promise.all([
    count('contacts?select=id'),
    count(`contacts?select=id&created_at=gte.${fromISO}&created_at=lt.${toISO}`),
    count('conversations?select=contact_id&last_from_me=is.false'),
    count(`flow_sessions?select=contact_id&status=eq.done&updated_at=gte.${fromISO}&updated_at=lt.${toISO}`),
    count('flow_sessions?select=contact_id&status=eq.handoff'),
  ])

  // Mensagens do período (para contagens e tempo de resposta).
  const msgs: { from_me: boolean; sent_at: string; contact_id: string }[] = await (
    await rest(`messages?select=from_me,sent_at,contact_id&sent_at=gte.${fromISO}&sent_at=lt.${toISO}&order=contact_id,sent_at.asc&limit=10000`)
  ).json()

  let recebidas = 0
  let enviadas = 0
  const deltas: number[] = []
  const pendente: Record<string, number> = {} // contato -> hora da 1ª msg do paciente sem resposta
  for (const m of msgs) {
    const t = Date.parse(m.sent_at)
    if (m.from_me) {
      enviadas++
      const p = pendente[m.contact_id]
      if (p != null) {
        const min = (t - p) / 60000
        if (min >= 0 && min <= 720) deltas.push(min) // ignora gaps > 12h
        delete pendente[m.contact_id]
      }
    } else {
      recebidas++
      if (pendente[m.contact_id] == null) pendente[m.contact_id] = t
    }
  }
  const tempoMedioRespMin = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null

  // Ranking de atendentes (precisa da coluna sent_by; se não existir, fica vazio).
  let ranking: { atendente: string; respostas: number }[] = []
  try {
    const rows: { sent_by: string }[] = await (
      await rest(`messages?select=sent_by&from_me=is.true&sent_by=not.is.null&sent_at=gte.${fromISO}&sent_at=lt.${toISO}&limit=10000`)
    ).json()
    const acc: Record<string, number> = {}
    for (const r of rows) acc[r.sent_by] = (acc[r.sent_by] || 0) + 1
    ranking = Object.entries(acc)
      .map(([atendente, respostas]) => ({ atendente, respostas }))
      .sort((a, b) => b.respostas - a.respostas)
  } catch {
    /* coluna sent_by ainda não criada */
  }

  return { leadsPeriodo, leadsTotal, emAberto, fechadas, emAtendimento, recebidas, enviadas, tempoMedioRespMin, ranking }
}

export async function getStats(): Promise<Stats> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const iso = start.toISOString()

  const [totalContatos, leadsHoje, aguardando, msgsHoje] = await Promise.all([
    count('contacts?select=id'),
    count(`contacts?select=id&created_at=gte.${iso}`),
    count('conversations?select=contact_id&last_from_me=is.false'),
    count(`messages?select=id&sent_at=gte.${iso}`),
  ])

  return { totalContatos, leadsHoje, aguardando, msgsHoje }
}
