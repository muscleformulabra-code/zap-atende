import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ALL_TRUE } from '@/lib/perms'
import { membershipByEmail } from '@/lib/company'
import { SESSION_MAX_AGE } from '@/lib/session'

// Retorna quem é o atendente logado + sua empresa e permissões (lidas do
// vínculo). Também "auto-cura" os cookies za_company/za_perms — assim quem já
// estava logado antes do multi-empresa, e quem acabou de ser convidado, passa
// a ter a empresa sem precisar deslogar.
export async function GET() {
  const jar = await cookies()
  const email = jar.get('za_email')?.value ?? null
  const membership = email ? await membershipByEmail(email).catch(() => null) : null

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
  if (membership) {
    res.cookies.set('za_company', membership.company_id, opts)
    res.cookies.set('za_perms', membership.perms ? JSON.stringify(membership.perms) : '', opts)
  }
  return res
}
