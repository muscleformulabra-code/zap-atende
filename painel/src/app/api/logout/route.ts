import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url))
  res.cookies.set('za_token', '', { path: '/', maxAge: 0 })
  res.cookies.set('za_email', '', { path: '/', maxAge: 0 })
  return res
}
