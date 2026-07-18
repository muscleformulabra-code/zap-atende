import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { openAIStatus, saveOpenAIKey } from '@/lib/settings-db'

// A chave da OpenAI é credencial sensível: SÓ dono/admin (perms nulo = acesso
// total) pode ver ou mexer. Atendente comum não vê nem edita.
async function requireAdmin() {
  const m = await currentMembership()
  return m && !m.perms ? m : null
}

// Status da integração OpenAI (nunca devolve a chave inteira).
export async function GET() {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ configured: false, restricted: true })
  return NextResponse.json(await openAIStatus(m.company_id))
}

// Salvar a chave (só dono/admin).
export async function POST(req: Request) {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Só administradores podem alterar a chave' }, { status: 403 })
  const { openaiKey } = await req.json().catch(() => ({}))
  const key = (openaiKey || '').trim()
  if (!key) return NextResponse.json({ error: 'Informe a chave' }, { status: 400 })
  if (!key.startsWith('sk-')) return NextResponse.json({ error: 'A chave da OpenAI começa com "sk-"' }, { status: 400 })
  await saveOpenAIKey(m.company_id, key)
  return NextResponse.json({ ok: true })
}

// Remover a chave (só dono/admin).
export async function DELETE() {
  const m = await requireAdmin()
  if (!m) return NextResponse.json({ error: 'Só administradores podem alterar a chave' }, { status: 403 })
  await saveOpenAIKey(m.company_id, null)
  return NextResponse.json({ ok: true })
}
