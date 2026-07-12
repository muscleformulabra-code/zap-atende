import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { mfaVerify } from '@/lib/auth'
import { setSessionCookies } from '@/lib/session'
import { acceptPendingInvites } from '@/lib/team'

// Etapa 2 do login com 2FA: recebe o código de 6 dígitos, verifica o fator e,
// se ok, completa a sessão (aal2). O token temporário vem do cookie za_mfa.
export async function POST(req: Request) {
  const jar = await cookies()
  const temp = jar.get('za_mfa')?.value
  if (!temp) return NextResponse.json({ error: 'Sessão de login expirou. Entre novamente.' }, { status: 401 })

  const { factorId, code } = await req.json().catch(() => ({}))
  if (!factorId || !code) return NextResponse.json({ error: 'Informe o código de 6 dígitos' }, { status: 400 })

  try {
    const session = await mfaVerify(temp, factorId, code)
    const mail = session.user?.email || ''
    const membership = await acceptPendingInvites(session.user.id, mail).catch(() => null)
    const res = NextResponse.json({ ok: true, hasCompany: !!membership })
    setSessionCookies(res, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      email: mail,
      companyId: membership?.company_id ?? null,
      perms: membership?.perms ?? null,
    })
    res.cookies.set('za_mfa', '', { path: '/', maxAge: 0 }) // limpa o temporário
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }
}
