import { NextResponse } from 'next/server'
import { currentCompanyId, SEED_COMPANY_ID } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Desconecta o WhatsApp da empresa ativa (desvincula o aparelho) e mantém
// desligado — não gera QR nem reconecta sozinho. Só as outras empresas seguem.
export async function POST() {
  try {
    const company = (await currentCompanyId()) || SEED_COMPANY_ID
    const r = await fetch(`${CONNECTOR_URL}/disconnect?company=${company}&confirm=yes`, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
    const d = await r.json().catch(() => ({}))
    return NextResponse.json({ ok: true, ...d })
  } catch {
    return NextResponse.json({ ok: true, disconnecting: true })
  }
}
