import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { getAssistantConfigRaw, saveAssistantConfig } from '@/lib/settings-db'
import { normalizeAssistantConfig, ASSISTANT_MODELS } from '@/lib/assistant'

// Carrega a config do assistente da empresa (com defaults preenchidos).
export async function GET() {
  const m = await currentMembership()
  if (!m) return NextResponse.json({ config: normalizeAssistantConfig(null), models: ASSISTANT_MODELS })
  const raw = await getAssistantConfigRaw(m.company_id)
  return NextResponse.json({ config: normalizeAssistantConfig(raw), models: ASSISTANT_MODELS })
}

// Salva a config (só quem tem acesso a Configurações).
export async function POST(req: Request) {
  const m = await currentMembership()
  if (!m || (m.perms && !m.perms.config)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const config = normalizeAssistantConfig(body?.config)
  await saveAssistantConfig(m.company_id, config)
  return NextResponse.json({ ok: true })
}
