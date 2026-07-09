import { NextResponse } from 'next/server'
import { createUser, deleteUser, listUsers, updateUserPerms } from '@/lib/auth'

export async function GET() {
  return NextResponse.json(await listUsers())
}

export async function POST(req: Request) {
  const { email, password, perms } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  if (String(password).length < 6) return NextResponse.json({ error: 'Senha mínima de 6 caracteres' }, { status: 400 })
  try {
    const u = await createUser(email, password, perms)
    return NextResponse.json({ id: u.id, email: u.email })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Atualiza as permissões de um atendente.
export async function PATCH(req: Request) {
  const { id, perms } = await req.json().catch(() => ({}))
  if (!id || !perms) return NextResponse.json({ error: 'id e perms obrigatórios' }, { status: 400 })
  try {
    await updateUserPerms(id, perms)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteUser(id)
  return NextResponse.json({ ok: true })
}
