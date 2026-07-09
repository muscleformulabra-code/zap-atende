// Autenticação via Supabase Auth (gotrue) por REST — sem criar tabelas
// (o banco está em IPv6; gotrue gerencia os usuários sozinho).
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

// Cria um atendente (admin API, com a service key).
export async function createUser(email: string, password: string) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
    cache: 'no-store',
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.msg || d.error_description || 'Erro ao criar atendente')
  return d
}

// Lista atendentes.
export async function listUsers(): Promise<{ id: string; email: string; created_at: string }[]> {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
    cache: 'no-store',
  })
  const d = await r.json()
  return (d.users || []).map((u: { id: string; email: string; created_at: string }) => ({ id: u.id, email: u.email, created_at: u.created_at }))
}

// Remove atendente.
export async function deleteUser(id: string) {
  await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
  })
}
