import { NextResponse } from 'next/server'
import { createFlow, listFlows } from '@/lib/flow-db'

// GET  -> lista todos os fluxos (id, nome, ativo).
export async function GET() {
  const rows = await listFlows()
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, name: r.name, is_active: r.is_active, updated_at: r.updated_at, folder_id: r.folder_id ?? null }))
  )
}

// POST { name } -> cria um novo fluxo (vazio).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const name = (body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })
  const flow = await createFlow(name)
  return NextResponse.json({ id: flow.id, name: flow.name })
}
