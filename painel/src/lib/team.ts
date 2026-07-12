// Equipe & Convites (modelo BotConversa): a pessoa se cadastra, mas só entra
// numa empresa quando o admin a convida pelo e-mail. Ao entrar, o convite
// pendente vira um vínculo (company_members).
import { normalizePerms, type Perms } from './perms'
import type { Membership, Role } from './company'

const URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_KEY
if (!URL || !SERVICE) throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')

const REST = `${URL}/rest/v1`
const H = { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

async function q(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${REST}/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) }, cache: 'no-store' })
}

export type Member = Membership & { created_at: string }
export type Invite = { id: string; company_id: string; email: string; role: Role; perms: Perms | null; status: string; invited_by: string | null; created_at: string }

// Membros (equipe) de uma empresa.
export async function listMembers(companyId: string): Promise<Member[]> {
  const r = await q(`company_members?company_id=eq.${companyId}&select=*&order=created_at.asc`)
  return r.ok ? r.json() : []
}

// Convites pendentes de uma empresa.
export async function listInvites(companyId: string): Promise<Invite[]> {
  const r = await q(`invites?company_id=eq.${companyId}&status=eq.pending&select=*&order=created_at.desc`)
  return r.ok ? r.json() : []
}

// Cria um convite (por e-mail). Se a pessoa JÁ tem conta, o vínculo é criado na
// hora; senão fica pendente até ela se cadastrar.
export async function createInvite(
  companyId: string,
  email: string,
  role: Role,
  perms: Partial<Perms> | null,
  invitedBy: string | null
): Promise<{ linkedNow: boolean }> {
  const e = email.trim().toLowerCase()
  if (!e) throw new Error('Informe o e-mail')
  const normPerms = perms === null ? null : normalizePerms(perms)

  // Já é membro? não duplica.
  const existing = await q(`company_members?company_id=eq.${companyId}&email=eq.${encodeURIComponent(e)}&select=id`)
  if ((await existing.json()).length) throw new Error('Essa pessoa já está na equipe')

  // A pessoa já tem conta no sistema? (procura no Auth pelo e-mail)
  const user = await findAuthUserByEmail(e)
  if (user) {
    await q('company_members', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ company_id: companyId, user_id: user.id, email: e, role, perms: normPerms, name: user.name }),
    })
    return { linkedNow: true }
  }

  // Ainda não tem conta → convite pendente.
  await q('invites', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ company_id: companyId, email: e, role, perms: normPerms, invited_by: invitedBy, status: 'pending' }),
  })
  return { linkedNow: false }
}

export async function revokeInvite(id: string, companyId: string): Promise<void> {
  await q(`invites?id=eq.${id}&company_id=eq.${companyId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// Ao logar/cadastrar: transforma convites pendentes desse e-mail em vínculos.
// Retorna o vínculo criado (ou o já existente), pra o login saber a empresa.
export async function acceptPendingInvites(userId: string, email: string): Promise<Membership | null> {
  const e = email.trim().toLowerCase()
  const r = await q(`invites?email=eq.${encodeURIComponent(e)}&status=eq.pending&select=*`)
  const invites: Invite[] = r.ok ? await r.json() : []
  for (const inv of invites) {
    await q('company_members?on_conflict=company_id,user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ company_id: inv.company_id, user_id: userId, email: e, role: inv.role, perms: inv.perms }),
    })
    await q(`invites?id=eq.${inv.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted' }) })
  }
  // Retorna o vínculo mais antigo (empresa principal).
  const m = await q(`company_members?user_id=eq.${userId}&select=*&order=created_at.asc&limit=1`)
  return m.ok ? (await m.json())[0] ?? null : null
}

// Atualiza um membro (papel/permissões) — usado pelo admin na Equipe.
export async function updateMember(id: string, companyId: string, patch: { role?: Role; perms?: Partial<Perms> | null }): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.role) body.role = patch.role
  if ('perms' in patch) body.perms = patch.perms === null ? null : normalizePerms(patch.perms)
  await q(`company_members?id=eq.${id}&company_id=eq.${companyId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

// Remove alguém da equipe (não apaga a conta, só o vínculo com a empresa).
export async function removeMember(id: string, companyId: string): Promise<void> {
  await q(`company_members?id=eq.${id}&company_id=eq.${companyId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// Atualiza o PERFIL do próprio usuário (nome, telefone, foto) em todos os
// vínculos dele (aparece igual em todas as empresas).
export async function updateProfile(userId: string, patch: { name?: string; phone?: string; avatar_url?: string | null }): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.name = patch.name?.trim() || null
  if (patch.phone !== undefined) body.phone = patch.phone?.trim() || null
  if (patch.avatar_url !== undefined) body.avatar_url = patch.avatar_url
  await q(`company_members?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
}

// Procura um usuário do Supabase Auth pelo e-mail (admin API).
async function findAuthUserByEmail(email: string): Promise<{ id: string; name: string | null } | null> {
  const r = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SERVICE!, Authorization: `Bearer ${SERVICE}` },
    cache: 'no-store',
  })
  if (!r.ok) return null
  const d = await r.json()
  type RawUser = { id: string; email: string; user_metadata?: { name?: string } }
  const u = (d.users || []).find((x: RawUser) => (x.email || '').toLowerCase() === email)
  return u ? { id: u.id, name: u.user_metadata?.name || null } : null
}
