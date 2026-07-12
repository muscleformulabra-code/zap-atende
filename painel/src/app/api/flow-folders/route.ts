import { NextResponse } from 'next/server'
import { listFolders, createFolder, renameFolder, deleteFolder } from '@/lib/flow-db'

export async function GET() {
  return NextResponse.json(await listFolders())
}

export async function POST(req: Request) {
  const { name } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })
  await createFolder(name)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const { id, name } = await req.json().catch(() => ({}))
  if (!id || !name?.trim()) return NextResponse.json({ error: 'id e nome obrigatórios' }, { status: 400 })
  await renameFolder(id, name)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteFolder(id)
  return NextResponse.json({ ok: true })
}
