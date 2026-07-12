import { NextResponse } from 'next/server'
import { currentCompanyId, SEED_COMPANY_ID } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Estado da conexão com o WhatsApp DA EMPRESA do atendente (consulta o
// conector). Usado pelo indicador "online/offline" no menu lateral.
export async function GET() {
  try {
    const company = (await currentCompanyId()) || SEED_COMPANY_ID
    const r = await fetch(`${CONNECTOR_URL}/status?company=${company}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!r.ok) return NextResponse.json({ whatsapp: false, connector: false })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ whatsapp: !!d.whatsapp, connector: true })
  } catch {
    return NextResponse.json({ whatsapp: false, connector: false })
  }
}
