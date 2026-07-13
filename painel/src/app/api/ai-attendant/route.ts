import { NextResponse } from 'next/server'
import { getAiAttendant, saveAiAttendant } from '@/lib/settings-db'
import { normalizeAi } from '@/lib/ai-attendant'
import { currentCompanyId } from '@/lib/company'

// Config do Atendente IA (Sofia) da empresa ativa.
export async function GET() {
  return NextResponse.json(await getAiAttendant())
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}))
  const c = await currentCompanyId()
  if (!c) return NextResponse.json({ error: 'Sem empresa' }, { status: 401 })
  await saveAiAttendant(c, normalizeAi(body))
  return NextResponse.json({ ok: true })
}
