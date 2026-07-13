import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ALL_TRUE } from '@/lib/perms'
import { membershipByEmail, membershipByEmailCompany } from '@/lib/company'
import { SESSION_MAX_AGE } from '@/lib/session'

// Extrai o e-mail de dentro do token de sessão (JWT do Supabase). Usado pra
// "auto-curar" quando o cookie za_email sumiu mas a sessão continua válida
// (ex.: um logout antigo que limpou o e-mail e deixou o token vivo).
function emailFromToken(token?: string | null): string | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const data = JSON.parse(json)
    return data.email || data.user_metadata?.email || null
  } catch {
    return null
  }
}

// Retorna quem é o atendente logado + sua empresa e permissões (lidas do
// vínculo). Também "auto-cura" os cookies za_email/za_company/za_perms — assim
// quem perdeu o cookie de e-mail (ou acabou de ser convidado) volta ao normal
// sem precisar deslogar.
export async function GET() {
  const jar = await cookies()
  let email = jar.get('za_email')?.value ?? null
  const activeCompany = jar.get('za_company')?.value ?? null

  // Sessão viva mas sem cookie de e-mail → recupera do próprio token.
  let recoveredEmail = false
  if (!email) {
    email = emailFromToken(jar.get('za_token')?.value)
    recoveredEmail = !!email
  }

  // Respeita a empresa ATIVA (cookie za_company) quando o usuário é membro dela
  // — assim a troca de empresa "gruda". Só cai no vínculo mais antigo se o
  // cookie estiver ausente ou apontar pra uma empresa que não é mais dele.
  let membership = null
  if (email) {
    if (activeCompany) membership = await membershipByEmailCompany(email, activeCompany).catch(() => null)
    if (!membership) membership = await membershipByEmail(email).catch(() => null)
  }

  const hasCompany = !!membership
  const admin = hasCompany && !membership!.perms
  const perms = membership?.perms ?? ALL_TRUE

  const res = NextResponse.json({
    email,
    name: membership?.name ?? null,
    phone: membership?.phone ?? null,
    avatar_url: membership?.avatar_url ?? null,
    hasCompany,
    admin,
    role: membership?.role ?? null,
    perms,
    company_id: membership?.company_id ?? null,
  })

  const opts = { path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' as const, httpOnly: true }
  if (recoveredEmail && email) res.cookies.set('za_email', email, opts)
  if (membership) {
    res.cookies.set('za_company', membership.company_id, opts)
    res.cookies.set('za_perms', membership.perms ? JSON.stringify(membership.perms) : '', opts)
  }
  return res
}
