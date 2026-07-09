import { NextResponse } from 'next/server'
import { signIn } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return NextResponse.json({ error: 'Informe e-mail e senha' }, { status: 400 })
  try {
    const auth = await signIn(email, password)
    const res = NextResponse.json({ ok: true })
    const maxAge = auth.expires_in || 3600
    res.cookies.set('za_token', auth.access_token, { httpOnly: true, path: '/', maxAge, sameSite: 'lax' })
    res.cookies.set('za_email', auth.user?.email || email, { path: '/', maxAge, sameSite: 'lax' })
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }
}
