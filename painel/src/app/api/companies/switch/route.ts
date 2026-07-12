import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { membershipByEmail, membershipOf } from '@/lib/company'
import { SESSION_MAX_AGE } from '@/lib/session'

const COOKIE = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' as const, httpOnly: true }

// Troca a empresa ativa. Só deixa trocar pra uma empresa de que o usuário é
// membro (valida o vínculo) e ajusta as permissões daquela empresa.
export async function POST(req: Request) {
  const email = (await cookies()).get('za_email')?.value
  if (!email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const me = await membershipByEmail(email)
  if (!me) return NextResponse.json({ error: 'Sem empresa' }, { status: 403 })

  const { companyId } = await req.json().catch(() => ({}))
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório' }, { status: 400 })

  const target = await membershipOf(me.user_id, companyId)
  if (!target) return NextResponse.json({ error: 'Você não faz parte dessa empresa' }, { status: 403 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('za_company', target.company_id, COOKIE)
  res.cookies.set('za_perms', target.perms ? JSON.stringify(target.perms) : '', COOKIE)
  return res
}
