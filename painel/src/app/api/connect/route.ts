import { NextResponse } from 'next/server'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Gera um QR novo: manda o conector apagar a sessão e reiniciar. O container
// reinicia (~30-40s) e volta oferecendo um QR fresco em /api/qr.
export async function POST() {
  try {
    const r = await fetch(`${CONNECTOR_URL}/reset?confirm=yes`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ ok: true, ...d })
  } catch {
    // O reset derruba o processo; a resposta pode não chegar — isso é esperado.
    return NextResponse.json({ ok: true, restarting: true })
  }
}
