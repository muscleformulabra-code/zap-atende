import { NextResponse } from 'next/server'
import { setDone } from '@/lib/db'

export async function POST(req: Request) {
  const { contactId } = await req.json().catch(() => ({}))
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })
  await setDone(contactId)
  return NextResponse.json({ ok: true })
}
