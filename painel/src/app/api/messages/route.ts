import { NextResponse } from 'next/server'
import { getMessages } from '@/lib/db'

export async function GET(req: Request) {
  const contactId = new URL(req.url).searchParams.get('contactId')
  if (!contactId) return NextResponse.json({ error: 'contactId obrigatório' }, { status: 400 })
  return NextResponse.json(await getMessages(contactId))
}
