import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { currentCompanyId, membershipByEmailCompany } from '@/lib/company'
import { listMembers, listInvites, createInvite, revokeInvite, updateMember, removeMember, type Member, type Invite } from '@/lib/team'
import type { Role } from '@/lib/company'

// Só admin (perms=null) ou quem tem a permissão "equipe" gerencia o time.
// IMPORTANTE: resolve o vínculo na EMPRESA ATIVA (cookie za_company), nunca na
// mais antiga — senão convite/lista/edição vazam pra empresa errada.
async function requireAdmin() {
  const companyId = await currentCompanyId()
  if (!companyId) return null
  const email = (await cookies()).get('za_email')?.value
  if (!email) return null
  const m = await membershipByEmailCompany(email, companyId)
  if (!m) return null
  if (m.perms && !m.perms.equipe) return null
  return m
}

export async function GET() {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const [members, invites]: [Member[], Invite[]] = await Promise.all([
    listMembers(m.company_id),
    listInvites(m.company_id),
  ])
  return NextResponse.json({ members, invites, meId: m.id })
}

// Convidar por e-mail.
export async function POST(req: Request) {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { email, perms, role } = await req.json().catch(() => ({}))
  if (!email) return NextResponse.json({ error: 'Informe o e-mail' }, { status: 400 })
  try {
    const r = await createInvite(m.company_id, email, (role as Role) || 'member', perms ?? null, m.email)
    return NextResponse.json({ ok: true, linkedNow: r.linkedNow })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Atualizar papel/permissões de um membro.
export async function PATCH(req: Request) {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id, perms, role } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  try {
    await updateMember(id, m.company_id, { perms, role })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

// Remover membro (?id=) ou revogar convite (?invite=).
export async function DELETE(req: Request) {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const invite = url.searchParams.get('invite')
  if (invite) await revokeInvite(invite, m.company_id)
  else if (id) await removeMember(id, m.company_id)
  else return NextResponse.json({ error: 'id ou invite obrigatório' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
