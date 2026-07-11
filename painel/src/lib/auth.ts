// Autenticação via Supabase Auth (gotrue) por REST — sem criar tabelas
// (o banco está em IPv6; gotrue gerencia os usuários sozinho).
import { normalizePerms, type Perms } from './perms'

const URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_KEY

if (!URL || !ANON || !SERVICE) {
  throw new Error('Faltam SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY em painel/.env.local')
}

export type AuthResult = { access_token: string; expires_in: number; user: { id: string; email: string } }

// Login (email + senha) -> token.
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error_description || d.msg || 'E-mail ou senha inválidos')
  return d
}

// Cria um atendente (admin API, com a service key) com suas permissões e nome.
export async function createUser(email: string, password: string, perms?: Partial<Perms>, name?: string) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { perms: normalizePerms(perms), name: name?.trim() || null } }),
    cache: 'no-store',
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.msg || d.error_description || 'Erro ao criar atendente')
  return d
}

// Lê o user_metadata atual de um usuário (pra mesclar sem apagar campos).
async function getMeta(id: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
    cache: 'no-store',
  })
  const d = await r.json().catch(() => ({}))
  return d.user_metadata || {}
}

// Atualiza permissões e/ou nome (mescla no metadata pra não apagar o outro campo).
export async function updateUser(id: string, patch: { perms?: Partial<Perms> | null; name?: string }) {
  const meta = { ...(await getMeta(id)) }
  if ('perms' in patch) {
    if (patch.perms === null) delete meta.perms // null = dono/admin (sem perms)
    else meta.perms = normalizePerms(patch.perms)
  }
  if ('name' in patch) meta.name = patch.name?.trim() || null
  const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_metadata: meta }),
    cache: 'no-store',
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).msg || 'Erro ao salvar')
}

export type TeamUser = { id: string; email: string; name: string | null; created_at: string; perms: Perms | null }

// Lista atendentes com suas permissões e nome. perms=null => DONO/admin.
export async function listUsers(): Promise<TeamUser[]> {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
    cache: 'no-store',
  })
  const d = await r.json()
  type RawUser = { id: string; email: string; created_at: string; user_metadata?: { perms?: Partial<Perms>; name?: string } }
  return (d.users || [])
    .map((u: RawUser) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || null,
      created_at: u.created_at,
      perms: u.user_metadata?.perms ? normalizePerms(u.user_metadata.perms) : null,
    }))
    .sort((a: TeamUser, b: TeamUser) => a.created_at.localeCompare(b.created_at))
}

// Deriva um nome apresentável do e-mail (fallback quando o nome não foi definido).
export function nameFromEmail(email?: string | null): string | null {
  const local = (email || '').split('@')[0]
  const parts = local.split(/[._-]+/).filter((p) => p && !/^\d+$/.test(p))
  if (!parts.length) return null
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

// Nome do atendente pelo e-mail (pra prefixar as mensagens enviadas por ele).
export async function getUserName(email: string): Promise<string | null> {
  try {
    const users = await listUsers()
    const u = users.find((x) => (x.email || '').toLowerCase() === (email || '').toLowerCase())
    return u?.name || nameFromEmail(email)
  } catch {
    return nameFromEmail(email)
  }
}

// Remove atendente.
export async function deleteUser(id: string) {
  await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
  })
}
