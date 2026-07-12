import { NextResponse } from 'next/server'
import { listCampaigns, createCampaign, updateCampaign, deleteCampaign } from '@/lib/campaigns-db'

export async function GET() {
  return NextResponse.json(await listCampaigns())
}

export async function POST(req: Request) {
  const { name, flowId, phrase } = await req.json().catch(() => ({}))
  if (!name?.trim() || !phrase?.trim()) return NextResponse.json({ error: 'Informe nome e frase' }, { status: 400 })
  await createCampaign(name, flowId || null, phrase)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const { id, name, flowId, phrase } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await updateCampaign(id, { name, flow_id: flowId, phrase })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await deleteCampaign(id)
  return NextResponse.json({ ok: true })
}
