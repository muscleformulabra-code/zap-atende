import { NextResponse } from 'next/server'
import { currentCompanyId, SEED_COMPANY_ID } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Gera um QR novo pra empresa do atendente: apaga a sessão DELA e reinicia só
// essa sessão (as outras empresas continuam conectadas). Volta com QR fresco.
export async function POST() {
  try {
    const company = (await currentCompanyId()) || SEED_COMPANY_ID
    const r = await fetch(`${CONNECTOR_URL}/reset?company=${company}&confirm=yes`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ ok: true, ...d })
  } catch {
    return NextResponse.json({ ok: true, restarting: true })
  }
}
