import { NextResponse } from 'next/server'
import { listLabels, createLabel, updateLabel, deleteLabel } from '@/lib/db'

export async function GET() {
  return NextResponse.json(await listLabels())
}

export async function POST(req: Request) {
  const { name, description, color } = await req.json().catch(() => ({}))
  if (!name || !name.trim()) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 })
  await createLabel(name, description || '', color || 'gray')
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const { id, name, description, color } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await updateLabel(id, { name, description, color })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteLabel(id)
  return NextResponse.json({ ok: true })
}
