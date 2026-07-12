// Acesso aos ASSISTENTES (tabela assistants) via Supabase REST — server-side.
import { currentCompanyId, SEED_COMPANY_ID } from './company'
import { defaultAssistant, normalizeAssistant, type Assistant } from './assistant'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')

const REST = `${URL}/rest/v1`
const H = { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function cid(explicit?: string): Promise<string> {
  return explicit ?? (await currentCompanyId()) ?? SEED_COMPANY_ID
}

// Lista os assistentes da empresa. Na 1ª vez, cria um padrão.
export async function listAssistants(): Promise<Assistant[]> {
  const c = await cid()
  const r = await fetch(`${REST}/assistants?company_id=eq.${c}&select=*&order=created_at.asc`, { headers: H, cache: 'no-store' })
  if (!r.ok) return []
  const rows = await r.json()
  if (rows.length > 0) return rows.map(normalizeAssistant)
  // Primeiro acesso → cria um assistente padrão.
  const created = await createAssistant({ ...defaultAssistant(), name: 'Assistente de Leads' })
  return created ? [created] : []
}

export async function getAssistant(id: string): Promise<Assistant | null> {
  const c = await cid()
  const r = await fetch(`${REST}/assistants?id=eq.${id}&company_id=eq.${c}&select=*&limit=1`, { headers: H, cache: 'no-store' })
  if (!r.ok) return null
  const rows = await r.json()
  return rows[0] ? normalizeAssistant(rows[0]) : null
}

export async function createAssistant(data: Partial<Omit<Assistant, 'id'>>): Promise<Assistant | null> {
  const c = await cid()
  const base = defaultAssistant()
  const row = { ...base, ...data, company_id: c }
  const r = await fetch(`${REST}/assistants`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`createAssistant ${r.status}: ${await r.text()}`)
  const rows = await r.json()
  return rows[0] ? normalizeAssistant(rows[0]) : null
}

export async function updateAssistant(id: string, patch: Partial<Assistant>): Promise<void> {
  const c = await cid()
  const body: Record<string, unknown> = { ...patch }
  delete body.id
  await fetch(`${REST}/assistants?id=eq.${id}&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

export async function deleteAssistant(id: string): Promise<void> {
  const c = await cid()
  await fetch(`${REST}/assistants?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } })
}
