import { NextResponse } from 'next/server'
import { signIn, hasVerifiedTotp } from '@/lib/auth'
import { setSessionCookies } from '@/lib/session'
import { acceptPendingInvites } from '@/lib/team'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  try {
    const auth = await signIn(email, password)
    const mail = auth.user?.email || email

    // 2FA: se o usuário tem TOTP ativo, NÃO completa o login ainda — guarda o
    // token num cookie curto e pede o código (etapa 2). Fail-open: se a checagem
    // falhar, segue o login normal (nunca trava ninguém).
    const { has, factorId } = await hasVerifiedTotp(auth.access_token)
    if (has && factorId) {
      const res = NextResponse.json({ ok: true, mfaRequired: true, factorId })
      res.cookies.set('za_mfa', auth.access_token, { path: '/', maxAge: 300, sameSite: 'lax', httpOnly: true })
      return res
    }

    // Sem 2FA: completa normalmente.
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
