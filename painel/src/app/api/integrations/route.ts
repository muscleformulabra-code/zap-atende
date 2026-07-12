import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { openAIStatus, saveOpenAIKey } from '@/lib/settings-db'

// Status da integração OpenAI (nunca devolve a chave inteira).
export async function GET() {
  const m = await currentMembership()
  if (!m) return NextResponse.json({ configured: false })
  return NextResponse.json(await openAIStatus(m.company_id))
}

// Salvar a chave (só admin/dono — quem tem acesso a Configurações).
export async function POST(req: Request) {
  const m = await currentMembership()
  if (!m || (m.perms && !m.perms.config)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { openaiKey } = await req.json().catch(() => ({}))
  const key = (openaiKey || '').trim()
  if (!key) return NextResponse.json({ error: 'Informe a chave' }, { status: 400 })
  if (!key.startsWith('sk-')) return NextResponse.json({ error: 'A chave da OpenAI começa com "sk-"' }, { status: 400 })
  await saveOpenAIKey(m.company_id, key)
  return NextResponse.json({ ok: true })
}

// Remover a chave.
export async function DELETE() {
  const m = await currentMembership()
  if (!m || (m.perms && !m.perms.config)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  await saveOpenAIKey(m.company_id, null)
  return NextResponse.json({ ok: true })
}
