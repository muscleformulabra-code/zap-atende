import { NextResponse } from 'next/server'
import { createContact, importContacts, listContacts } from '@/lib/db'

// Lista/busca contatos.
export async function GET(req: Request) {
  const search = new URL(req.url).searchParams.get('search') ?? undefined
  return NextResponse.json(await listContacts(search))
}

// Cria um contato manualmente.
export async function POST(req: Request) {
  const { name, phone } = await req.json().catch(() => ({}))
  if (!phone) return NextResponse.json({ error: 'Telefone obrigatório' }, { status: 400 })
  try {
    await createContact(name, phone)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Importa vários contatos de uma vez (CSV).
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
