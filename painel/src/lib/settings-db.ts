// Configurações da plataforma (linha única id=1) via Supabase REST.

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

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${REST}/settings?id=eq.1&select=*&limit=1`, { headers: H, cache: 'no-store' })
  if (!res.ok) throw new Error(`getSettings ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  return rows[0]
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const put = async (body: Record<string, unknown>) =>
    fetch(`${REST}/settings?id=eq.1`, {
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
