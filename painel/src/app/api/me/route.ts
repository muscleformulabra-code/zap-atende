import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ALL_TRUE, permsFromJwt } from '@/lib/perms'

// Retorna o e-mail e as permissões do atendente logado (lidas do JWT no cookie).
// Sem permissões definidas = DONO/admin (acesso total).
export async function GET() {
  const jar = await cookies()
  const token = jar.get('za_token')?.value
  const email = jar.get('za_email')?.value ?? null
  const perms = token ? permsFromJwt(token) : null
  return NextResponse.json({ email, admin: perms === null, perms: perms ?? ALL_TRUE })
}
