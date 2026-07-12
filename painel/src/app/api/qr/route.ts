import { NextResponse } from 'next/server'
import { currentCompanyId, SEED_COMPANY_ID } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Repassa a imagem do QR code do conector (da empresa do atendente). 204 = não
// há QR (já conectado ou ainda gerando). Usada pela aba de Conexão.
export async function GET() {
  try {
    const company = (await currentCompanyId()) || SEED_COMPANY_ID
    const r = await fetch(`${CONNECTOR_URL}/qr.png?company=${company}&t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return new NextResponse(null, { status: 204 })
    const buf = await r.arrayBuffer()
    return new NextResponse(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
