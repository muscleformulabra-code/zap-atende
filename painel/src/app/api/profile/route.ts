import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { membershipByEmail } from '@/lib/company'
import { updateProfile } from '@/lib/team'

// Atualiza o perfil do próprio atendente (nome, telefone, foto).
export async function POST(req: Request) {
  const jar = await cookies()
  const email = jar.get('za_email')?.value
  if (!email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const m = await membershipByEmail(email)
  if (!m) return NextResponse.json({ error: 'Sem empresa' }, { status: 403 })

  const { name, phone, avatar_url } = await req.json().catch(() => ({}))
  await updateProfile(m.user_id, { name, phone, avatar_url })
  return NextResponse.json({ ok: true })
}
