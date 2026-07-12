import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { listMembers } from '@/lib/team'

// Lista simples dos atendentes da empresa (nome + e-mail) para o inbox:
// mostrar "meu nome" e o menu de atribuição. Liberado a qualquer membro
// (não é admin-only como o /api/team).
export async function GET() {
  const m = await currentMembership()
  if (!m) return NextResponse.json([])
  const members = await listMembers(m.company_id)
  return NextResponse.json(members.map((u) => ({ email: u.email, name: u.name })))
}
