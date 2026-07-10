import { NextResponse } from 'next/server'
import { createContact, deleteContact, importContacts, listContacts } from '@/lib/db'

// Lista/busca contatos (com filtro opcional por etiqueta).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? undefined
  const tag = url.searchParams.get('tag') ?? undefined
  return NextResponse.json(await listContacts(search, tag))
}

// Cria um contato manualmente.
export async function POST(req: Request) {
  const { name, phone, tags } = await req.json().catch(() => ({}))
  if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
  try {
    await createContact(name, phone, Array.isArray(tags) ? tags : undefined)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Importa vários contatos de uma vez (planilha xlsx/csv).
export async function PUT(req: Request) {
  const { rows } = await req.json().catch(() => ({}))
  if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows deve ser uma lista' }, { status: 400 })
  try {
    const n = await importContacts(rows)
    return NextResponse.json({ ok: true, imported: n })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Exclui um contato.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    await deleteContact(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
