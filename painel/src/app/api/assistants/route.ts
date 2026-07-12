import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { listAssistants, createAssistant, updateAssistant, deleteAssistant } from '@/lib/assistants-db'
import { ASSISTANT_MODELS, defaultAssistant } from '@/lib/assistant'

// Lista os assistentes da empresa (+ modelos sugeridos). Remove o texto pesado
// do conhecimento — o cliente só precisa dos metadados dos arquivos.
export async function GET() {
  const assistants = (await listAssistants()).map((a) => ({
    ...a,
    knowledge: undefined,
    files: (a.files || []).map((f) => ({ name: f.name, url: f.url, chars: f.chars })),
  }))
  return NextResponse.json({ assistants, models: ASSISTANT_MODELS })
}

async function requireConfig() {
  const m = await currentMembership()
  if (!m) return null
  if (m.perms && !m.perms.config) return null
  return m
}

// Cria um assistente novo.
export async function POST(req: Request) {
  if (!(await requireConfig())) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { name } = await req.json().catch(() => ({}))
  const a = await createAssistant({ ...defaultAssistant(), name: (name || '').trim() || 'Novo assistente' })
  return NextResponse.json({ ok: true, assistant: a })
}

// Atualiza um assistente (config).
export async function PATCH(req: Request) {
  if (!(await requireConfig())) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { id, ...patch } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await updateAssistant(id, patch)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  if (!(await requireConfig())) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteAssistant(id)
  return NextResponse.json({ ok: true })
}
