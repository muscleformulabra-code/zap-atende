import { NextResponse } from 'next/server'
import { setStatus } from '@/lib/db'

const VALID = ['active', 'handoff', 'done']

// Muda o status do atendimento (concluir/reabrir/assumir) a partir do inbox.
export async function POST(req: Request) {
  const { contactId, status } = await req.json().catch(() => ({}))
  if (!contactId || !VALID.includes(status)) {
    return NextResponse.json({ error: 'contactId e status (active|handoff|done) obrigatórios' }, { status: 400 })
  }
  await setStatus(contactId, status)
  return NextResponse.json({ ok: true })
}
