import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { membershipByEmail, myCompanies, createCompany } from '@/lib/company'
import { SESSION_MAX_AGE } from '@/lib/session'

const COOKIE = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' as const, httpOnly: true }

async function currentUser() {
  const email = (await cookies()).get('za_email')?.value
  if (!email) return null
  return membershipByEmail(email)
}

// Lista as empresas do usuário logado (pro seletor "Minhas empresas").
export async function GET() {
  const me = await currentUser()
  if (!me) return NextResponse.json([])
  return NextResponse.json(await myCompanies(me.user_id))
}

// Cria uma empresa nova (o usuário vira DONO) e já TROCA pra ela.
export async function POST(req: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { name } = await req.json().catch(() => ({}))
  try {
    const company = await createCompany(name, me.user_id, me.email)
    const res = NextResponse.json({ ok: true, id: company.id, name: company.name })
    // Entra já na empresa nova (dono = acesso total, perms vazio).
    res.cookies.set('za_company', company.id, COOKIE)
    res.cookies.set('za_perms', '', COOKIE)
    return res
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
