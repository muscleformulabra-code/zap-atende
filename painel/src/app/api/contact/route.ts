import { NextResponse } from 'next/server'
import { getContactCard, updateContact } from '@/lib/db'

// Ficha do lead (dados + status) pro painel do inbox.
export async function GET(req: Request) {
  const contactId = new URL(req.url).searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })
  const card = await getContactCard(contactId)
  if (!card) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })
  return NextResponse.json(card)
}

// Atualiza nome / observação do contato (editado na ficha do inbox).
export async function PATCH(req: Request) {
  const { contactId, name, note } = await req.json().catch(() => ({}))
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })
  await updateContact(contactId, { name, note })
  return NextResponse.json({ ok: true })
}
