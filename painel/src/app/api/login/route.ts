import { NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'
import { setSessionCookies } from '@/lib/session'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  try {
    const auth = await signIn(email, password)
    const res = NextResponse.json({ ok: true })
    setSessionCookies(res, {
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      email: auth.user?.email || email,
    })
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }
}
