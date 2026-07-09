import { NextResponse } from 'next/server'
import { createQuickReply, deleteQuickReply, listQuickReplies } from '@/lib/db'

export async function GET() {
  return NextResponse.json(await listQuickReplies())
}

export async function POST(req: Request) {
  const { shortcut, text } = await req.json().catch(() => ({}))
  if (!shortcut || !text) return NextResponse.json({ error: 'atalho e texto obrigatórios' }, { status: 400 })
  try {
    await createQuickReply(String(shortcut).trim().replace(/^\//, ''), text)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteQuickReply(id)
  return NextResponse.json({ ok: true })
}
