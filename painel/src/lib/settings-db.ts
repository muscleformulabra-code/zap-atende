// Configurações da plataforma (uma linha POR EMPRESA) via Supabase REST.

import { currentCompanyId, SEED_COMPANY_ID } from './company'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')
}

const REST = `${SUPABASE_URL}/rest/v1`
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function cid(explicit?: string): Promise<string> {
  return explicit ?? (await currentCompanyId()) ?? SEED_COMPANY_ID
}

export type Hours = { days: number[]; start: string; end: string }
export type Settings = {
  bot_enabled: boolean
  company_name: string
  hours: Hours
  off_hours_message: string
  min_delay_ms: number
  max_delay_ms: number
  default_flow_id: string | null // fluxo de resposta padrão
  media_flow_id: string | null   // fluxo padrão para mídia
}

export async function getSettings(companyId?: string): Promise<Settings> {
  const c = await cid(companyId)
  const res = await fetch(`${REST}/settings?company_id=eq.${c}&select=*&limit=1`, { headers: H, cache: 'no-store' })
  if (!res.ok) throw new Error(`getSettings ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (rows[0]) return rows[0]
  // Empresa nova ainda sem linha de configurações → cria com os padrões.
  const created = await fetch(`${REST}/settings`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({ company_id: c }),
    cache: 'no-store',
  })
  if (created.ok) return (await created.json())[0]
  return rows[0]
}

// ── Chave da OpenAI (Assistente de Leads) — SEMPRE server-side ──
// Lê a chave da empresa; se não tiver, cai no fallback OPENAI_API_KEY (env).
export async function getOpenAIKey(companyId?: string): Promise<string | null> {
  const c = await cid(companyId)
  try {
    const res = await fetch(`${REST}/settings?company_id=eq.${c}&select=openai_key&limit=1`, { headers: H, cache: 'no-store' })
    if (res.ok) {
      const rows = await res.json()
      const k = rows[0]?.openai_key
      if (k && String(k).trim()) return String(k).trim()
    }
  } catch {
    /* coluna pode não existir ainda */
  }
  return process.env.OPENAI_API_KEY?.trim() || null
}

// Salva (ou apaga com null) a chave da OpenAI da empresa.
export async function saveOpenAIKey(companyId: string, key: string | null): Promise<void> {
  const c = await cid(companyId)
  await fetch(`${REST}/settings?company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ openai_key: key }),
    cache: 'no-store',
  })
}

// Status da integração (SEM devolver a chave inteira — só se está configurada
// e uma prévia dos últimos 4 dígitos).
export async function openAIStatus(companyId?: string): Promise<{ configured: boolean; preview: string | null; fromEnv: boolean }> {
  const c = await cid(companyId)
  let companyKey: string | null = null
  try {
    const res = await fetch(`${REST}/settings?company_id=eq.${c}&select=openai_key&limit=1`, { headers: H, cache: 'no-store' })
    if (res.ok) companyKey = (await res.json())[0]?.openai_key || null
  } catch {}
  const envKey = process.env.OPENAI_API_KEY?.trim() || null
  const key = (companyKey && companyKey.trim()) || envKey
  return {
    configured: !!key,
    preview: key ? `sk-…${key.slice(-4)}` : null,
    fromEnv: !companyKey && !!envKey,
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const c = await cid()
  const put = async (body: Record<string, unknown>) =>
    fetch(`${REST}/settings?company_id=eq.${c}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      cache: 'no-store',
    })

  let res = await put(patch)
  if (!res.ok) {
    // Colunas default_flow_id/media_flow_id ainda não migradas → salva sem elas.
    const rest = { ...patch }
    delete (rest as Partial<Settings>).default_flow_id
    delete (rest as Partial<Settings>).media_flow_id
    if (Object.keys(rest).length > 0) {
      res = await put(rest)
      if (!res.ok) throw new Error(`saveSettings ${res.status}: ${await res.text()}`)
    }
  }
}
