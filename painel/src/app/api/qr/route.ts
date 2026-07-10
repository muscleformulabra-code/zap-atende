import { NextResponse } from 'next/server'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Repassa a imagem do QR code do conector. 204 = não há QR (já conectado ou
// ainda gerando). Usada pela aba de Conexão nas Configurações.
export async function GET() {
  try {
    const r = await fetch(`${CONNECTOR_URL}/qr.png?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return new NextResponse(null, { status: 204 })
    const buf = await r.arrayBuffer()
    return new NextResponse(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
