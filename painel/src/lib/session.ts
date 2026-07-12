// Cookies da sessão do atendente. Mantém o login vivo por bastante tempo e
// renova o token automaticamente (ver middleware), pra ninguém ser deslogado
// no meio do atendimento.
import type { NextResponse } from 'next/server'

// 30 dias parado ainda mantém a sessão (o refresh_token do Supabase renova o
// token de acesso enquanto a pessoa estiver usando).
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

type SessionData = { access_token: string; refresh_token?: string; email?: string | null }

// Grava (ou renova) os cookies da sessão numa resposta.
export function setSessionCookies(res: NextResponse, s: SessionData) {
  const opts = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' as const }
  res.cookies.set('za_token', s.access_token, { ...opts, httpOnly: true })
  if (s.refresh_token) res.cookies.set('za_refresh', s.refresh_token, { ...opts, httpOnly: true })
  if (s.email) res.cookies.set('za_email', s.email, opts)
}

// Limpa a sessão (logout / refresh inválido).
export function clearSessionCookies(res: NextResponse) {
  res.cookies.set('za_token', '', { path: '/', maxAge: 0 })
  res.cookies.set('za_refresh', '', { path: '/', maxAge: 0 })
  res.cookies.set('za_email', '', { path: '/', maxAge: 0 })
}
