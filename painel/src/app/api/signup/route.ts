import { NextResponse } from 'next/server'
import { signUp, signIn } from '@/lib/auth'
import { setSessionCookies } from '@/lib/session'
import { acceptPendingInvites } from '@/lib/team'

// Cadastro público (tipo BotConversa): cria a conta e já loga. Se a pessoa foi
// convidada antes, entra direto na empresa; senão vai pra tela de espera.
export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  if (String(password).length < 8) return NextResponse.json({ error: 'A senha precisa ter ao menos 8 caracteres' }, { status: 400 })
  try {
    const user = await signUp(email, password, name)
    const membership = await acceptPendingInvites(user.id, user.email).catch(() => null)
    const auth = await signIn(email, password) // loga em seguida
    const res = NextResponse.json({ ok: true, hasCompany: !!membership })
    setSessionCookies(res, {
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      email: user.email,
      companyId: membership?.company_id ?? null,
      perms: membership?.perms ?? null,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
