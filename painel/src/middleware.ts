import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PERM_LIST, permForPath, permsFromCookie, secondsUntilExpiry } from './lib/perms'

// Rotas abertas (sem login): login, cadastro público, APIs de auth, e as APIs
// que o CONECTOR (servidor externo) chama sem cookie.
const OPEN = ['/login', '/cadastro', '/api/login', '/api/signup', '/api/logout', '/api/simulate', '/api/settings']

// Rotas liberadas pra quem está logado mas AINDA não tem empresa (aguardando
// convite): a tela de espera, o perfil e as APIs que elas usam.
const NO_COMPANY_OK = ['/aguardando', '/perfil', '/api/profile', '/api/me']

const RENEW_OPTS = { path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax' as const, httpOnly: true }

// Renova a sessão pelo refresh_token (chamado quando o token de acesso está
// perto de expirar). Inline aqui pra o middleware não depender de mais nada.
async function refresh(refreshToken: string) {
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    })
    if (!r.ok) return null
    return (await r.json()) as { access_token: string; refresh_token: string }
  } catch {
    return null
  }
}

function toLogin(req: NextRequest, clear = false) {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  const res = NextResponse.redirect(url)
  if (clear) {
    res.cookies.set('za_token', '', { path: '/', maxAge: 0 })
    res.cookies.set('za_refresh', '', { path: '/', maxAge: 0 })
    res.cookies.set('za_email', '', { path: '/', maxAge: 0 })
  }
  return res
}

function setRenewed(res: NextResponse, r: { access_token: string; refresh_token: string }) {
  res.cookies.set('za_token', r.access_token, RENEW_OPTS)
  res.cookies.set('za_refresh', r.refresh_token, RENEW_OPTS)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('za_token')?.value
  const refreshToken = req.cookies.get('za_refresh')?.value
  if (!token && !refreshToken) return toLogin(req)

  // Logado mas sem empresa (aguardando convite): só pode ver a tela de espera
  // e o perfil. Qualquer outra rota → manda pra /aguardando.
  const company = req.cookies.get('za_company')?.value
  const noCompanyOk = NO_COMPANY_OK.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!company && !noCompanyOk) {
    const url = req.nextUrl.clone()
    url.pathname = '/aguardando'
    return NextResponse.redirect(url)
  }

  // Renova quando o token está expirado ou faltando <2min pra expirar — assim
  // ninguém é deslogado no meio do atendimento. A sessão só cai se o
  // refresh_token também morrer (30 dias sem usar).
  let activeToken = token
  let renewed: { access_token: string; refresh_token: string } | null = null
  const left = token ? secondsUntilExpiry(token) : null
  if (!token || left === null || left < 120) {
    if (!refreshToken) return toLogin(req, true)
    renewed = await refresh(refreshToken)
    if (!renewed) return toLogin(req, true)
    activeToken = renewed.access_token
  }

  // Bloqueio por permissão (só páginas; APIs passam). Lê do cookie za_perms
  // (permissões dentro da empresa). Vazio = dono/admin (acesso total).
  const need = permForPath(pathname)
  if (need) {
    const perms = permsFromCookie(req.cookies.get('za_perms')?.value)
    if (perms && !perms[need]) {
      const dest = PERM_LIST.find((p) => perms[p.key])?.href ?? '/login'
      const url = req.nextUrl.clone()
      url.pathname = dest
      const res = NextResponse.redirect(url)
      if (renewed) setRenewed(res, renewed)
      return res
    }
  }

  const res = NextResponse.next()
  if (renewed) setRenewed(res, renewed)
  return res
}

export const config = {
  // Ignora estáticos: _next e QUALQUER arquivo com extensão de imagem/ícone
  // (senão o middleware redireciona /ricco-logo.png etc. pro /login e a imagem
  // quebra pra quem não está logado — ex.: a logo na tela de login).
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
}
