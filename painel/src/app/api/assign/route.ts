import { NextResponse } from 'next/server'
import { setAssigned } from '@/lib/db'

// Atribui a conversa a um atendente (ou remove a atribuição com assignedTo=null).
export async function POST(req: Request) {
  const { contactId, assignedTo } = await req.json().catch(() => ({}))
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })
  await setAssigned(contactId, (assignedTo ?? '').trim() || null)
  return NextResponse.json({ ok: true })
}
