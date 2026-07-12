import { NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'
import { setSessionCookies } from '@/lib/session'
import { acceptPendingInvites } from '@/lib/team'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  try {
    const auth = await signIn(email, password)
    const mail = auth.user?.email || email
    // Aceita convites pendentes (vira membro da empresa) e descobre a empresa.
    const membership = await acceptPendingInvites(auth.user.id, mail).catch(() => null)
    const res = NextResponse.json({ ok: true, hasCompany: !!membership })
    setSessionCookies(res, {
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      email: mail,
      companyId: membership?.company_id ?? null,
      perms: membership?.perms ?? null,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }
}
