// Multi-empresa: resolve a qual EMPRESA o atendente logado pertence e isola
// todos os dados por company_id. É o coração da estrutura SaaS.
import { cookies } from 'next/headers'
import type { Perms } from './perms'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_KEY
if (!URL || !SERVICE) throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')

const REST = `${URL}/rest/v1`
const H = { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

// Id fixo da 1ª empresa (a clínica). Usado como padrão/fallback.
export const SEED_COMPANY_ID = '00000000-0000-0000-0000-000000000001'

export type Role = 'owner' | 'admin' | 'member'
export type Membership = {
  id: string
  company_id: string
  user_id: string
  email: string
  role: Role
  perms: Perms | null
  name: string | null
  phone: string | null
  avatar_url: string | null
}

export type Company = { id: string; name: string; created_at: string }

// Busca o vínculo (empresa) de um usuário pelo e-mail. null = ainda sem empresa
// (cadastrou mas não foi convidado). Pega o vínculo mais antigo se houver vários.
export async function membershipByEmail(email: string): Promise<Membership | null> {
  if (!email) return null
  const q = `company_members?email=eq.${encodeURIComponent(email)}&select=*&order=created_at.asc&limit=1`
  const r = await fetch(`${REST}/${q}`, { headers: H, cache: 'no-store' })
  if (!r.ok) return null
  const rows = await r.json()
  return rows[0] ?? null
}

// Vínculo por user_id (id do Supabase Auth).
export async function membershipByUser(userId: string): Promise<Membership | null> {
  if (!userId) return null
  const q = `company_members?user_id=eq.${userId}&select=*&order=created_at.asc&limit=1`
  const r = await fetch(`${REST}/${q}`, { headers: H, cache: 'no-store' })
  if (!r.ok) return null
  const rows = await r.json()
  return rows[0] ?? null
}

// Empresa (company) do atendente logado, lida do cookie de sessão.
// Retorna null se a pessoa ainda não tem empresa (aguardando convite).
export async function currentMembership(): Promise<Membership | null> {
  const jar = await cookies()
  const email = jar.get('za_email')?.value
  if (!email) return null
  return membershipByEmail(email)
}

// Atalho: só o company_id do logado (ou null). Use nas consultas para isolar.
// Lê primeiro o cookie za_company (rápido, sem ir ao banco); se faltar, resolve
// pelo e-mail. É o que as consultas usam pra não vazar dados entre empresas.
export async function currentCompanyId(): Promise<string | null> {
  const jar = await cookies()
  const fromCookie = jar.get('za_company')?.value
  if (fromCookie) return fromCookie
  const email = jar.get('za_email')?.value
  if (!email) return null
  return (await membershipByEmail(email))?.company_id ?? null
}

// Dados de uma empresa.
export async function getCompany(id: string): Promise<Company | null> {
  const r = await fetch(`${REST}/companies?id=eq.${id}&select=*&limit=1`, { headers: H, cache: 'no-store' })
  if (!r.ok) return null
  return (await r.json())[0] ?? null
}
