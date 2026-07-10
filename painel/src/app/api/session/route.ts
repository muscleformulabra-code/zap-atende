import { NextResponse } from 'next/server'
import { restartAutomation, setStatus } from '@/lib/db'

const VALID = ['active', 'handoff', 'done']

// Muda o status do atendimento (concluir/reabrir/assumir) ou reinicia a
// automação (status = 'restart' → zera a posição do fluxo).
export async function POST(req: Request) {
  const { contactId, status } = await req.json().catch(() => ({}))
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })

  if (status === 'restart') {
    await restartAutomation(contactId)
    return NextResponse.json({ ok: true, status: 'active' })
  }

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: 'status inválido (active|handoff|done|restart)' }, { status: 400 })
  }
  await setStatus(contactId, status)
  return NextResponse.json({ ok: true })
}
