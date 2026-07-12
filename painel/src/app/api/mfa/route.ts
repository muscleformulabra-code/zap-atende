import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { hasVerifiedTotp, mfaEnroll, mfaVerify, mfaUnenroll } from '@/lib/auth'
import { SESSION_MAX_AGE } from '@/lib/session'

const COOKIE = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' as const, httpOnly: true }

// Estado do 2FA do usuário logado.
export async function GET() {
  const token = (await cookies()).get('za_token')?.value
  if (!token) return NextResponse.json({ enabled: false })
  const { has, factorId } = await hasVerifiedTotp(token)
  return NextResponse.json({ enabled: has, factorId })
}

// Ações: enroll (gera QR), verify (confirma código), disable (remove).
export async function POST(req: Request) {
  const token = (await cookies()).get('za_token')?.value
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { action, factorId, code } = await req.json().catch(() => ({}))

  try {
    if (action === 'enroll') {
      const f = await mfaEnroll(token)
      return NextResponse.json({ ok: true, ...f })
    }
    if (action === 'verify') {
      if (!factorId || !code) return NextResponse.json({ error: 'Informe o código' }, { status: 400 })
      const session = await mfaVerify(token, factorId, code)
      // Sessão agora é aal2 — atualiza os cookies com os tokens novos.
      const res = NextResponse.json({ ok: true })
      if (session?.access_token) {
        res.cookies.set('za_token', session.access_token, COOKIE)
        if (session.refresh_token) res.cookies.set('za_refresh', session.refresh_token, COOKIE)
      }
      return res
    }
    if (action === 'disable') {
      if (!factorId) return NextResponse.json({ error: 'factorId obrigatório' }, { status: 400 })
      await mfaUnenroll(token, factorId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
