import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rotas abertas (sem login): tela de login, APIs de auth, e as APIs que o
// CONECTOR (servidor externo) chama sem cookie.
const OPEN = ['/login', '/api/login', '/api/logout', '/api/simulate', '/api/settings']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (OPEN.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  const token = req.cookies.get('za_token')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
