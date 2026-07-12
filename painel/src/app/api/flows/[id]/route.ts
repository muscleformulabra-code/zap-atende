import { NextResponse } from 'next/server'
import {
  deleteFlow,
  getFlow,
  renameFlow,
  setActiveFlow,
  updateFlowDefinition,
  moveFlow,
} from '@/lib/flow-db'
import type { FlowGraph } from '@/lib/flow-graph'

type Ctx = { params: Promise<{ id: string }> }

// GET -> um fluxo completo (para o construtor carregar).
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const flow = await getFlow(id)
  if (!flow) return NextResponse.json({ error: 'não encontrado' }, { status: 404 })
  return NextResponse.json({ id: flow.id, name: flow.name, is_active: flow.is_active, definition: flow.definition })
}

// PUT { definition } -> salva o grafo editado.
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const definition: FlowGraph | undefined = body?.definition
  if (!definition) return NextResponse.json({ error: 'definition obrigatório' }, { status: 400 })
  await updateFlowDefinition(id, definition)
  return NextResponse.json({ ok: true })
}

// PATCH { action: 'rename', name } | { action: 'activate' }
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (body?.action === 'rename') {
    const name = (body?.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })
    await renameFlow(id, name)
  } else if (body?.action === 'activate') {
    await setActiveFlow(id)
  } else if (body?.action === 'move') {
    await moveFlow(id, body?.folderId ?? null)
  } else {
    return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE -> remove o fluxo.
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await deleteFlow(id)
  return NextResponse.json({ ok: true })
}
