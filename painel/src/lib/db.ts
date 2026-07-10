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
  avatar_url: string | null
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

// Grava a posição completa da sessão de fluxo (usado ao "enviar fluxo" pelo inbox).
export async function setFlowSession(
  contactId: string,
  state: { flowId: string | null; currentNode: string | null; status: string }
): Promise<void> {
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: state.flowId,
      current_node: state.currentNode,
      status: state.status,
      updated_at: new Date().toISOString(),
    }),
  })
}

// Reinicia a automação do contato: zera a posição e volta a "active", com
// updated_at antigo pra que a próxima mensagem caia no fluxo de boas-vindas.
export async function restartAutomation(contactId: string): Promise<void> {
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: null,
      current_node: null,
      status: 'active',
      updated_at: new Date(0).toISOString(),
    }),
  })
}

// Ficha do lead: dados do contato + status do atendimento (pro painel do inbox).
export type ContactCard = {
  id: string
  name: string | null
  phone: string | null
  jid: string
  avatar_url: string | null
  created_at: string
  status: string
}

// ── Página de Contatos (lista, busca, criar, importar) ──
export type ContactRow = { id: string; name: string | null; phone: string | null; jid: string; created_at: string; tags: string[]; avatar_url: string | null }

// Normaliza um telefone para o padrão do WhatsApp (com DDI 55, sem símbolos).
// Não precisa digitar o +55: se vier só DDD + número, o 55 é adicionado sozinho.
//  • 13 díg. começando com 55 (55 + DDD + celular)  -> mantém
//  • 12 díg. começando com 55 (55 + DDD + fixo)      -> mantém
//  • 11 díg. (DDD + celular) ou 10 díg. (DDD + fixo) -> prefixa 55
function normPhone(phone: string): string {
  let d = (phone || '').replace(/\D/g, '').replace(/^0+/, '') // tira símbolos e zeros à esquerda
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) return d
  if (d.length === 10 || d.length === 11) return '55' + d
  return d // fora do padrão brasileiro: mantém como veio
}

function normTags(tags?: string[] | null): string[] {
  return (tags ?? [])
    .map((t) => (t || '').trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 40))
}

export async function listContacts(search?: string, tag?: string, limit = 1000): Promise<ContactRow[]> {
  let path = `contacts?select=id,name,phone,jid,created_at,tags,avatar_url&order=created_at.desc&limit=${limit}`
  if (search && search.trim()) {
    const s = encodeURIComponent(search.trim())
    path += `&or=(name.ilike.*${s}*,phone.ilike.*${s}*)`
  }
  if (tag && tag.trim()) {
    // filtro "contém a etiqueta" (array contains) do PostgREST.
    path += `&tags=cs.{${encodeURIComponent(tag.trim())}}`
  }
  try {
    const rows = await (await rest(path)).json()
    return (rows as ContactRow[]).map((r) => ({ ...r, tags: r.tags ?? [], avatar_url: r.avatar_url ?? null }))
  } catch {
    // Colunas tags/avatar_url ainda não criadas → busca só o básico.
    const fallback = `contacts?select=id,name,phone,jid,created_at&order=created_at.desc&limit=${limit}` + (search && search.trim() ? `&or=(name.ilike.*${encodeURIComponent(search.trim())}*,phone.ilike.*${encodeURIComponent(search.trim())}*)` : '')
    const rows = await (await rest(fallback)).json()
    return (rows as Omit<ContactRow, 'tags' | 'avatar_url'>[]).map((r) => ({ ...r, tags: [], avatar_url: null }))
  }
}

// Lista todas as etiquetas em uso, com a contagem de contatos por etiqueta.
export async function listTags(): Promise<{ tag: string; count: number }[]> {
  try {
    const rows: { tags: string[] | null }[] = await (
      await rest('contacts?select=tags&tags=not.is.null&limit=5000')
    ).json()
    const acc: Record<string, number> = {}
    for (const r of rows) for (const t of r.tags ?? []) if (t) acc[t] = (acc[t] || 0) + 1
    return Object.entries(acc)
      .map(([tag, c]) => ({ tag, count: c }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

export async function countContacts(): Promise<number> {
  return count('contacts?select=id')
}

// Upsert de contatos por jid. Tenta com `tags`; se a coluna ainda não existir
// no banco, refaz sem `tags` (assim a importação nunca quebra na transição).
async function upsertContacts(rows: Record<string, unknown>[]): Promise<void> {
  try {
    await rest('contacts?on_conflict=jid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
  } catch (e) {
    if (!rows.some((r) => 'tags' in r)) throw e
    const semTags = rows.map(({ tags, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
    await rest('contacts?on_conflict=jid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(semTags),
    })
  }
}

export async function createContact(name: string, phone: string, tags?: string[]): Promise<void> {
  const digits = normPhone(phone)
  if (digits.length < 8) throw new Error('Telefone inválido (informe com DDD)')
  await upsertContacts([{ jid: `${digits}@s.whatsapp.net`, phone: digits, name: name?.trim() || null, tags: normTags(tags) }])
}

// Importa vários contatos de uma vez (upsert por jid). Retorna quantos entraram.
export async function importContacts(rows: { name?: string; phone: string; tags?: string[] }[]): Promise<number> {
  const valid = rows
    .map((r) => ({ name: (r.name || '').trim() || null, phone: normPhone(r.phone), tags: normTags(r.tags) }))
    .filter((r) => r.phone.length >= 8)
    .map((r) => ({ jid: `${r.phone}@s.whatsapp.net`, phone: r.phone, name: r.name, tags: r.tags }))
  if (valid.length === 0) return 0
  for (let i = 0; i < valid.length; i += 500) {
    await upsertContacts(valid.slice(i, i + 500))
  }
  return valid.length
}

// Exclui um contato (usado pelo menu ⋮ da lista).
export async function deleteContact(id: string): Promise<void> {
  await rest(`contacts?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

export async function getContactCard(contactId: string): Promise<ContactCard | null> {
  const rows = await (await rest(`contacts?id=eq.${contactId}&select=*`)).json()
  const contact = rows[0]
  if (!contact) return null
  const sess = await (await rest(`flow_sessions?contact_id=eq.${contactId}&select=status`)).json()
  return { ...contact, avatar_url: contact.avatar_url ?? null, status: sess[0]?.status ?? 'active' }
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
