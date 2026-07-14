// Camada de dados: conversa com o Supabase via REST (PostgREST).
// Usada só no servidor (server components) — a service key nunca vai pro navegador.
//
// MULTI-EMPRESA: toda consulta é isolada por company_id (a empresa do atendente
// logado). Assim uma empresa nunca vê os dados da outra. O company_id é
// resolvido do cookie de sessão via currentCompanyId().
import { currentCompanyId, SEED_COMPANY_ID } from './company'

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

// Empresa do request. Fallback SEED só p/ contexto sem login (o conector, que
// hoje atende só a Empresa #1). Usuário logado sempre tem cookie za_company.
async function cid(explicit?: string): Promise<string> {
  return explicit ?? (await currentCompanyId()) ?? SEED_COMPANY_ID
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
  tags: string[]
  assigned_to: string | null
}

export async function getConversations(): Promise<Conversation[]> {
  const c = await cid()
  const [convs, sessions] = await Promise.all([
    (await rest(`conversations?company_id=eq.${c}&select=*&order=last_sent_at.desc.nullslast&limit=100`)).json(),
    (await rest(`flow_sessions?company_id=eq.${c}&select=contact_id,status,assigned_to`)).json(),
  ])
  const smap = new Map((sessions as { contact_id: string; status: string; assigned_to: string | null }[]).map((s) => [s.contact_id, s]))
  return (convs as (Omit<Conversation, 'status' | 'tags' | 'assigned_to'> & { tags?: string[] })[]).map((c) => {
    const s = smap.get(c.contact_id)
    return { ...c, phone: stripDevice(c.phone), tags: c.tags ?? [], status: s?.status ?? 'active', assigned_to: s?.assigned_to ?? null }
  })
}

export type Message = {
  id: string
  from_me: boolean
  text: string | null
  sent_at: string | null
  media_url?: string | null
  media_type?: string | null
  wa_message_id?: string | null
}

export async function getMessages(contactId: string): Promise<Message[]> {
  const c = await cid()
  try {
    const res = await rest(
      `messages?company_id=eq.${c}&contact_id=eq.${contactId}&select=id,from_me,text,sent_at,media_url,media_type,wa_message_id&order=sent_at.asc&limit=300`
    )
    return res.json()
  } catch {
    // Colunas de mídia ainda não migradas → busca sem elas.
    const res = await rest(
      `messages?company_id=eq.${c}&contact_id=eq.${contactId}&select=id,from_me,text,sent_at,wa_message_id&order=sent_at.asc&limit=300`
    )
    return res.json()
  }
}

// Metadados de uma mensagem (pra editar/encaminhar).
export async function getMessageMeta(messageId: string): Promise<{ jid: string; wa_message_id: string | null; text: string | null; media_url: string | null; media_type: string | null } | null> {
  const c = await cid()
  const rows = await (await rest(`messages?id=eq.${messageId}&company_id=eq.${c}&select=jid,wa_message_id,text,media_url,media_type`)).json()
  return rows[0] ?? null
}

// Atualiza o texto de uma mensagem (após editar no WhatsApp).
export async function updateMessageText(messageId: string, text: string): Promise<void> {
  const c = await cid()
  await rest(`messages?id=eq.${messageId}&company_id=eq.${c}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ text }) })
}

// Apaga a linha da mensagem no nosso banco (após apagar no WhatsApp).
export async function deleteMessageRow(messageId: string): Promise<{ jid: string; wa_message_id: string | null } | null> {
  const c = await cid()
  const rows = await (await rest(`messages?id=eq.${messageId}&company_id=eq.${c}&select=jid,wa_message_id`)).json()
  await rest(`messages?id=eq.${messageId}&company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  return rows[0] ?? null
}

export async function getContactJid(contactId: string): Promise<string | null> {
  const c = await cid()
  const res = await rest(`contacts?company_id=eq.${c}&id=eq.${contactId}&select=jid`)
  const rows = await res.json()
  return rows[0]?.jid ?? null
}

// ── Respostas rápidas (mensagens prontas /atalho) ──
export type QuickReply = { id: string; shortcut: string; text: string }

export async function listQuickReplies(): Promise<QuickReply[]> {
  try {
    const c = await cid()
    const res = await rest(`quick_replies?company_id=eq.${c}&select=id,shortcut,text&order=shortcut.asc`)
    return res.json()
  } catch {
    return [] // tabela ainda não criada
  }
}

export async function createQuickReply(shortcut: string, text: string): Promise<void> {
  const c = await cid()
  await rest('quick_replies', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ shortcut, text, company_id: c }),
  })
}

export async function deleteQuickReply(id: string): Promise<void> {
  const c = await cid()
  await rest(`quick_replies?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
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

// Conclui TODAS as conversas abertas da empresa (úteis quando um número novo
// sincroniza histórico antigo). Só mexe nas que não estão "done". Reversível.
export async function concludeAllOpen(): Promise<number> {
  const c = await cid()
  const [contacts, doneRows] = await Promise.all([
    (await rest(`contacts?company_id=eq.${c}&select=id&limit=100000`)).json() as Promise<{ id: string }[]>,
    (await rest(`flow_sessions?company_id=eq.${c}&status=eq.done&select=contact_id&limit=100000`)).json() as Promise<{ contact_id: string }[]>,
  ])
  const done = new Set((doneRows || []).map((d) => d.contact_id))
  const open = (contacts || []).filter((x) => !done.has(x.id))
  if (!open.length) return 0
  const now = new Date().toISOString()
  const rows = open.map((x) => ({ contact_id: x.id, company_id: c, status: 'done', updated_at: now }))
  for (let k = 0; k < rows.length; k += 500) {
    await rest('flow_sessions?on_conflict=contact_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(k, k + 500)),
    })
  }
  return rows.length
}

async function setSessionStatus(contactId: string, status: string): Promise<void> {
  const c = await cid()
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ contact_id: contactId, status, company_id: c, updated_at: new Date().toISOString() }),
  })
}

// Grava a posição completa da sessão de fluxo (usado ao "enviar fluxo" pelo inbox).
export async function setFlowSession(
  contactId: string,
  state: { flowId: string | null; currentNode: string | null; status: string }
): Promise<void> {
  const c = await cid()
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: state.flowId,
      current_node: state.currentNode,
      status: state.status,
      company_id: c,
      updated_at: new Date().toISOString(),
    }),
  })
}

// Reinicia a automação do contato: zera a posição e volta a "active", com
// updated_at antigo pra que a próxima mensagem caia no fluxo de boas-vindas.
export async function restartAutomation(contactId: string): Promise<void> {
  const c = await cid()
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      contact_id: contactId,
      flow_id: null,
      current_node: null,
      status: 'active',
      company_id: c,
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
  assigned_to: string | null
  note: string | null
}

// Atualiza campos editáveis do contato (nome, observação) pela ficha do inbox.
export async function updateContact(contactId: string, patch: { name?: string | null; note?: string | null }): Promise<void> {
  const c = await cid()
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = (patch.name || '').trim() || null
  if (patch.note !== undefined) body.note = patch.note ?? null
  await rest(`contacts?id=eq.${contactId}&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

// Atribui (ou remove, com null) o atendente "dono" da conversa.
export async function setAssigned(contactId: string, assignedTo: string | null): Promise<void> {
  const c = await cid()
  await rest('flow_sessions?on_conflict=contact_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ contact_id: contactId, assigned_to: assignedTo, company_id: c, updated_at: new Date().toISOString() }),
  })
}

// ── Página de Contatos (lista, busca, criar, importar) ──
export type ContactRow = { id: string; name: string | null; phone: string | null; jid: string; created_at: string; tags: string[]; avatar_url: string | null }

// Normaliza um telefone para o padrão do WhatsApp (com DDI 55, sem símbolos).
// Não precisa digitar o +55: se vier só DDD + número, o 55 é adicionado sozinho.
//  • 13 díg. começando com 55 (55 + DDD + celular)  -> mantém
//  • 12 díg. começando com 55 (55 + DDD + fixo)      -> mantém
//  • 11 díg. (DDD + celular) ou 10 díg. (DDD + fixo) -> prefixa 55
// Remove o sufixo de aparelho do WhatsApp (multi-device): "556183741339:0" → "556183741339".
function stripDevice(phone: string | null): string | null {
  return phone ? phone.split(':')[0] : phone
}

function normPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '').replace(/^0+/, '') // tira símbolos e zeros à esquerda
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
  const c = await cid()
  let path = `contacts?company_id=eq.${c}&select=id,name,phone,jid,created_at,tags,avatar_url&order=created_at.desc&limit=${limit}`
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
    return (rows as ContactRow[]).map((r) => ({ ...r, phone: stripDevice(r.phone), tags: r.tags ?? [], avatar_url: r.avatar_url ?? null }))
  } catch {
    // Colunas tags/avatar_url ainda não criadas → busca só o básico.
    const fallback = `contacts?company_id=eq.${c}&select=id,name,phone,jid,created_at&order=created_at.desc&limit=${limit}` + (search && search.trim() ? `&or=(name.ilike.*${encodeURIComponent(search.trim())}*,phone.ilike.*${encodeURIComponent(search.trim())}*)` : '')
    const rows = await (await rest(fallback)).json()
    return (rows as Omit<ContactRow, 'tags' | 'avatar_url'>[]).map((r) => ({ ...r, phone: stripDevice(r.phone), tags: [], avatar_url: null }))
  }
}

// Lista todas as etiquetas em uso, com a contagem de contatos por etiqueta.
export async function listTags(): Promise<{ tag: string; count: number }[]> {
  try {
    const c = await cid()
    const rows: { tags: string[] | null }[] = await (
      await rest(`contacts?company_id=eq.${c}&select=tags&tags=not.is.null&limit=5000`)
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

// ── Catálogo de ETIQUETAS (tags table: nome + descrição + cor) ──
export type Label = { id: string; name: string; description: string | null; color: string; created_at: string }

export async function listLabels(): Promise<Label[]> {
  try {
    const c = await cid()
    return await (await rest(`tags?company_id=eq.${c}&select=*&order=name.asc`)).json()
  } catch {
    return [] // tabela ainda não criada
  }
}

export async function createLabel(name: string, description: string, color: string): Promise<void> {
  const c = await cid()
  await rest('tags?on_conflict=company_id,name', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ company_id: c, name: name.trim(), description: description?.trim() || null, color: color || 'gray' }),
  })
}

export async function updateLabel(id: string, patch: { name?: string; description?: string; color?: string }): Promise<void> {
  const c = await cid()
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.description !== undefined) body.description = patch.description?.trim() || null
  if (patch.color !== undefined) body.color = patch.color
  await rest(`tags?id=eq.${id}&company_id=eq.${c}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
}

export async function deleteLabel(id: string): Promise<void> {
  const c = await cid()
  await rest(`tags?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

export async function countContacts(): Promise<number> {
  const c = await cid()
  return count(`contacts?company_id=eq.${c}&select=id`)
}

// Upsert de contatos por jid. Tenta com `tags`; se a coluna ainda não existir
// no banco, refaz sem `tags` (assim a importação nunca quebra na transição).
// company_id é carimbado em cada linha (isola a empresa).
async function upsertContacts(rows: Record<string, unknown>[]): Promise<void> {
  const c = await cid()
  const stamped: Record<string, unknown>[] = rows.map((r) => ({ ...r, company_id: c }))
  try {
    await rest('contacts?on_conflict=company_id,jid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(stamped),
    })
  } catch (e) {
    if (!stamped.some((r) => 'tags' in r)) throw e
    const semTags = stamped.map(({ tags, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
    await rest('contacts?on_conflict=company_id,jid', {
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
  const c = await cid()
  await rest(`contacts?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// Exclui TODOS os contatos da empresa (e mensagens em cascata). Destrutivo —
// a rota exige confirmação digitada. Retorna quantos foram apagados.
export async function deleteAllContacts(): Promise<number> {
  const c = await cid()
  const before = await count(`contacts?company_id=eq.${c}&select=id`)
  await rest(`contacts?company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  return before
}

export async function getContactCard(contactId: string): Promise<ContactCard | null> {
  const c = await cid()
  const rows = await (await rest(`contacts?id=eq.${contactId}&company_id=eq.${c}&select=*`)).json()
  const contact = rows[0]
  if (!contact) return null
  const sess = await (await rest(`flow_sessions?contact_id=eq.${contactId}&select=status,assigned_to`)).json()
  return { ...contact, phone: stripDevice(contact.phone), avatar_url: contact.avatar_url ?? null, status: sess[0]?.status ?? 'active', assigned_to: sess[0]?.assigned_to ?? null }
}

export type Stats = {
  totalContatos: number
  leadsHoje: number
  aguardando: number
  msgsHoje: number
}

export type WaitingLead = { contact_id: string; name: string | null; phone: string | null; last_text: string | null; waitingMin: number }

// Pendência = lead onde o PACIENTE falou por último e a conversa não foi
// concluída. Sai quando o atendente responde (last_from_me vira true) ou conclui
// (status done); volta se o paciente mandar mensagem de novo.
export type Pendencia = { contact_id: string; name: string | null; phone: string | null; last_text: string | null; last_sent_at: string | null; waitingMin: number }

export async function getPendencias(): Promise<Pendencia[]> {
  const c = await cid()
  const [convsRaw, sessions] = (await Promise.all([
    rest(`conversations?company_id=eq.${c}&select=contact_id,name,phone,last_text,last_sent_at,last_from_me,last_sent_by&order=last_sent_at.desc.nullslast&limit=500`).then((r) => r.json()),
    rest(`flow_sessions?company_id=eq.${c}&select=contact_id,status&limit=50000`).then((r) => r.json()),
  ])) as [{ contact_id: string; name: string | null; phone: string | null; last_text: string | null; last_sent_at: string | null; last_from_me: boolean | null; last_sent_by: string | null }[], { contact_id: string; status: string }[]]
  const statusOf = new Map((sessions || []).map((s) => [s.contact_id, s.status]))
  const now = Date.now()
  return (convsRaw || [])
    .filter((cv) => {
      const st = statusOf.get(cv.contact_id)
      if (st === 'done') return false
      // Pendência quando:
      //  a) o PACIENTE falou por último (está esperando resposta), OU
      //  b) a IA passou pro humano (handoff) e a ÚLTIMA msg é do BOT (sent_by
      //     null) — ou seja, nenhum atendente respondeu ainda.
      // Se um atendente já respondeu (last_sent_by = e-mail), sai da fila.
      return cv.last_from_me === false || (st === 'handoff' && !cv.last_sent_by)
    })
    .map((cv) => ({
      contact_id: cv.contact_id,
      name: cv.name,
      phone: stripDevice(cv.phone),
      last_text: cv.last_text,
      last_sent_at: cv.last_sent_at,
      waitingMin: cv.last_sent_at ? Math.max(0, Math.round((now - Date.parse(cv.last_sent_at)) / 60000)) : 0,
    }))
    .sort((a, b) => b.waitingMin - a.waitingMin)
}
export type AttendantStat = { atendente: string; respostas: number; tempoRespMin: number | null }
export type DayPoint = { date: string; novosContatos: number; conversasUnicas: number; abertas: number; encerradas: number }
export type MemberStat = {
  name: string
  respondido: number
  fechado: number
  primeiraMedianaSeg: number | null
  primeiraMediaSeg: number | null
  fechamentoMedianaSeg: number | null
  fechamentoMediaSeg: number | null
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
  taxaResposta: number | null // % de conversas do período que receberam resposta
  waiting: WaitingLead[] // leads aguardando resposta AGORA (mais antigo primeiro)
  ranking: AttendantStat[]
  series: DayPoint[] // estatísticas por dia (pro gráfico)
  members: MemberStat[] // estatísticas de chat por membro
}

// Análise completa por período [fromISO, toISO).
export async function getAnalytics(fromISO: string, toISO: string): Promise<Analytics> {
  const c = await cid()
  const [leadsTotal, leadsPeriodo, fechadas, emAtendimento, convsRaw, sessRaw, msgs, contactsCreated, doneInPeriod, membersRows] = await Promise.all([
    count(`contacts?company_id=eq.${c}&select=id`),
    count(`contacts?company_id=eq.${c}&select=id&created_at=gte.${fromISO}&created_at=lt.${toISO}`),
    count(`flow_sessions?company_id=eq.${c}&select=contact_id&status=eq.done&updated_at=gte.${fromISO}&updated_at=lt.${toISO}`),
    count(`flow_sessions?company_id=eq.${c}&select=contact_id&status=eq.handoff`),
    // conversas onde o PACIENTE falou por último (candidatas a "aguardando")
    rest(`conversations?company_id=eq.${c}&select=contact_id,name,phone,last_text,last_sent_at&last_from_me=is.false&order=last_sent_at.asc.nullslast&limit=300`).then((r) => r.json()),
    rest(`flow_sessions?company_id=eq.${c}&select=contact_id,status`).then((r) => r.json()),
    rest(`messages?company_id=eq.${c}&select=from_me,sent_at,contact_id,sent_by&sent_at=gte.${fromISO}&sent_at=lt.${toISO}&order=contact_id,sent_at.asc&limit=20000`).then((r) => r.json()),
    rest(`contacts?company_id=eq.${c}&select=created_at&created_at=gte.${fromISO}&created_at=lt.${toISO}&limit=50000`).then((r) => r.json()),
    rest(`flow_sessions?company_id=eq.${c}&status=eq.done&updated_at=gte.${fromISO}&updated_at=lt.${toISO}&select=contact_id,assigned_to,updated_at&limit=50000`).then((r) => r.json()),
    rest(`company_members?company_id=eq.${c}&select=email,name`).then((r) => r.json()).catch(() => []),
  ]) as [number, number, number, number, { contact_id: string; name: string | null; phone: string | null; last_text: string | null; last_sent_at: string | null }[], { contact_id: string; status: string }[], { from_me: boolean; sent_at: string; contact_id: string; sent_by: string | null }[], { created_at: string }[], { contact_id: string; assigned_to: string | null; updated_at: string }[], { email: string; name: string | null }[]]

  // ── Leads AGUARDANDO resposta agora (exclui os concluídos) ──
  const doneSet = new Set(sessRaw.filter((s) => s.status === 'done').map((s) => s.contact_id))
  const now = Date.now()
  const waiting: WaitingLead[] = convsRaw
    .filter((c) => !doneSet.has(c.contact_id))
    .map((c) => ({
      contact_id: c.contact_id,
      name: c.name,
      phone: c.phone,
      last_text: c.last_text,
      waitingMin: c.last_sent_at ? Math.max(0, Math.round((now - Date.parse(c.last_sent_at)) / 60000)) : 0,
    }))
    .sort((a, b) => b.waitingMin - a.waitingMin)
  const emAberto = waiting.length

  // ── Mensagens do período: contagens, tempo de resposta (geral e por atendente) ──
  let recebidas = 0
  let enviadas = 0
  const deltas: number[] = []
  const pendente: Record<string, number> = {}
  const respostasContato = new Set<string>() // contatos que receberam ao menos 1 resposta
  const recebidosContato = new Set<string>()
  const attCount: Record<string, number> = {}
  const attDeltas: Record<string, number[]> = {}
  for (const m of msgs) {
    const t = Date.parse(m.sent_at)
    if (m.from_me) {
      enviadas++
      if (m.sent_by) attCount[m.sent_by] = (attCount[m.sent_by] || 0) + 1
      const p = pendente[m.contact_id]
      if (p != null) {
        const min = (t - p) / 60000
        if (min >= 0 && min <= 720) {
          deltas.push(min)
          if (m.sent_by) (attDeltas[m.sent_by] ??= []).push(min)
        }
        respostasContato.add(m.contact_id)
        delete pendente[m.contact_id]
      }
    } else {
      recebidas++
      recebidosContato.add(m.contact_id)
      if (pendente[m.contact_id] == null) pendente[m.contact_id] = t
    }
  }
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null)
  const tempoMedioRespMin = avg(deltas)
  const taxaResposta = recebidosContato.size ? Math.round((respostasContato.size / recebidosContato.size) * 100) : null

  // Ranking de atendentes: mensagens enviadas + tempo médio de resposta.
  const ranking: AttendantStat[] = Object.keys(attCount)
    .map((atendente) => ({ atendente, respostas: attCount[atendente], tempoRespMin: avg(attDeltas[atendente] ?? []) }))
    .sort((a, b) => b.respostas - a.respostas)

  // ── SÉRIE DIÁRIA (pro gráfico) — buckets por dia no fuso de Brasília (-3h) ──
  const BR = 3 * 3600 * 1000
  const dayKey = (iso: string) => new Date(Date.parse(iso) - BR).toISOString().slice(0, 10)
  const dayKeys: string[] = []
  {
    const startDay = dayKey(fromISO)
    let t = Date.parse(startDay + 'T00:00:00Z') + BR // volta pro UTC do início do dia BR
    const end = Date.parse(toISO)
    while (t < end) { dayKeys.push(dayKey(new Date(t).toISOString())); t += 86400000 }
    if (dayKeys.length === 0) dayKeys.push(startDay)
  }
  const novos: Record<string, number> = {}, encerr: Record<string, number> = {}
  const uniqSets: Record<string, Set<string>> = {}, abertasSets: Record<string, Set<string>> = {}
  for (const ct of contactsCreated) { const k = dayKey(ct.created_at); novos[k] = (novos[k] || 0) + 1 }
  for (const m of msgs) { const k = dayKey(m.sent_at); (uniqSets[k] ??= new Set()).add(m.contact_id); if (!m.from_me) (abertasSets[k] ??= new Set()).add(m.contact_id) }
  for (const s of doneInPeriod) { const k = dayKey(s.updated_at); encerr[k] = (encerr[k] || 0) + 1 }
  const series: DayPoint[] = dayKeys.map((k) => ({ date: k, novosContatos: novos[k] || 0, conversasUnicas: uniqSets[k]?.size || 0, abertas: abertasSets[k]?.size || 0, encerradas: encerr[k] || 0 }))

  // ── ESTATÍSTICAS POR MEMBRO ──
  const email2name: Record<string, string> = {}
  for (const u of membersRows) if (u.email) email2name[u.email.toLowerCase()] = u.name || u.email
  const nameOf = (sentBy: string | null) => (sentBy ? email2name[sentBy.toLowerCase()] || sentBy.split('@')[0] : '—')
  type PC = { firstIn: number | null; firstOut: { nm: string; t: number } | null; members: Set<string> }
  const perContact: Record<string, PC> = {}
  for (const m of msgs) {
    const pc = (perContact[m.contact_id] ??= { firstIn: null, firstOut: null, members: new Set() })
    const t = Date.parse(m.sent_at)
    if (m.from_me) { const nm = nameOf(m.sent_by); pc.members.add(nm); if (pc.firstOut == null) pc.firstOut = { nm, t } }
    else if (pc.firstIn == null) pc.firstIn = t
  }
  const respondido: Record<string, number> = {}, fechadoM: Record<string, number> = {}
  const firstResp: Record<string, number[]> = {}, closeT: Record<string, number[]> = {}
  for (const cId in perContact) {
    const pc = perContact[cId]
    for (const nm of pc.members) respondido[nm] = (respondido[nm] || 0) + 1
    if (pc.firstOut && pc.firstIn != null) { const d = (pc.firstOut.t - pc.firstIn) / 1000; if (d >= 0) (firstResp[pc.firstOut.nm] ??= []).push(d) }
  }
  for (const s of doneInPeriod) {
    const nm = s.assigned_to
    if (!nm) continue
    fechadoM[nm] = (fechadoM[nm] || 0) + 1
    const pc = perContact[s.contact_id]
    if (pc && pc.firstIn != null) { const d = (Date.parse(s.updated_at) - pc.firstIn) / 1000; if (d >= 0) (closeT[nm] ??= []).push(d) }
  }
  const median = (a?: number[]) => { if (!a?.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? Math.round(s[m]) : Math.round((s[m - 1] + s[m]) / 2) }
  const meanS = (a?: number[]) => (a?.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null)
  const memberKeys = [...new Set([...Object.keys(respondido), ...Object.keys(fechadoM)])].filter((k) => k !== '—')
  const members: MemberStat[] = memberKeys
    .map((nm) => ({ name: nm, respondido: respondido[nm] || 0, fechado: fechadoM[nm] || 0, primeiraMedianaSeg: median(firstResp[nm]), primeiraMediaSeg: meanS(firstResp[nm]), fechamentoMedianaSeg: median(closeT[nm]), fechamentoMediaSeg: meanS(closeT[nm]) }))
    .sort((a, b) => b.respondido + b.fechado - (a.respondido + a.fechado))

  return { leadsPeriodo, leadsTotal, emAberto, fechadas, emAtendimento, recebidas, enviadas, tempoMedioRespMin, taxaResposta, waiting, ranking, series, members }
}

export async function getStats(): Promise<Stats> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const iso = start.toISOString()

  const c = await cid()
  const [totalContatos, leadsHoje, aguardando, msgsHoje] = await Promise.all([
    count(`contacts?company_id=eq.${c}&select=id`),
    count(`contacts?company_id=eq.${c}&select=id&created_at=gte.${iso}`),
    count(`conversations?company_id=eq.${c}&select=contact_id&last_from_me=is.false`),
    count(`messages?company_id=eq.${c}&select=id&sent_at=gte.${iso}`),
  ])

  return { totalContatos, leadsHoje, aguardando, msgsHoje }
}
