import { NextResponse } from 'next/server'

// Sai da conta. Usa status 303 (See Other) de propósito: o botão "Sair" é um
// POST, e 303 faz o navegador seguir o redirect como GET — senão ele re-envia
// o POST pra /login e a página responde 405 (Method Not Allowed).
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303)
  const kill = { path: '/', maxAge: 0 }
  for (const c of ['za_token', 'za_refresh', 'za_email', 'za_company', 'za_perms']) {
    res.cookies.set(c, '', kill)
  }
  return res
}
