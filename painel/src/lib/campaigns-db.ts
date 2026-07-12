// Campanhas (tráfego pago) via Supabase REST — server-side.
import { currentCompanyId, SEED_COMPANY_ID } from './company'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!URL || !KEY) throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')

const REST = `${URL}/rest/v1`
const H = { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function cid(): Promise<string> { return (await currentCompanyId()) ?? SEED_COMPANY_ID }

export type Campaign = { id: string; name: string; flow_id: string | null; phrase: string; participants: number; executions: number; created_at: string }

export async function listCampaigns(): Promise<Campaign[]> {
  const c = await cid()
  try {
    const r = await fetch(`${REST}/campaigns?company_id=eq.${c}&select=*&order=created_at.desc`, { headers: H, cache: 'no-store' })
    return r.ok ? r.json() : []
  } catch {
    return []
  }
}

export async function createCampaign(name: string, flowId: string | null, phrase: string): Promise<void> {
  const c = await cid()
  await fetch(`${REST}/campaigns`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ company_id: c, name: name.trim(), flow_id: flowId, phrase: phrase.trim() }) })
}

export async function updateCampaign(id: string, patch: { name?: string; flow_id?: string | null; phrase?: string }): Promise<void> {
  const c = await cid()
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.flow_id !== undefined) body.flow_id = patch.flow_id
  if (patch.phrase !== undefined) body.phrase = patch.phrase.trim()
  await fetch(`${REST}/campaigns?id=eq.${id}&company_id=eq.${c}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(body) })
}

export async function deleteCampaign(id: string): Promise<void> {
  const c = await cid()
  await fetch(`${REST}/campaigns?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } })
}
