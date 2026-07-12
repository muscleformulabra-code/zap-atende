import { NextResponse } from 'next/server'
import { listFlows, setActiveFlow } from '@/lib/flow-db'
import { getSettings, saveSettings } from '@/lib/settings-db'

// Fluxos Padrões: qual fluxo é o de boas-vindas (ativo), resposta padrão e mídia.
export async function GET() {
  const [flows, s] = await Promise.all([listFlows(), getSettings()])
  return NextResponse.json({
    flows: flows.map((f) => ({ id: f.id, name: f.name, is_active: f.is_active })),
    welcomeFlowId: flows.find((f) => f.is_active)?.id ?? null,
    defaultFlowId: (s as { default_flow_id?: string | null }).default_flow_id ?? null,
    mediaFlowId: (s as { media_flow_id?: string | null }).media_flow_id ?? null,
  })
}

// Define os fluxos padrões. welcomeFlowId ativa o fluxo (desativa os outros).
export async function POST(req: Request) {
  const { welcomeFlowId, defaultFlowId, mediaFlowId } = await req.json().catch(() => ({}))
  if (welcomeFlowId) await setActiveFlow(welcomeFlowId)
  if (defaultFlowId !== undefined || mediaFlowId !== undefined) {
    const patch: Record<string, unknown> = {}
    if (defaultFlowId !== undefined) patch.default_flow_id = defaultFlowId || null
    if (mediaFlowId !== undefined) patch.media_flow_id = mediaFlowId || null
    await saveSettings(patch)
  }
  return NextResponse.json({ ok: true })
}
