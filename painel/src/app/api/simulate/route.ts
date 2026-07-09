import { NextResponse } from 'next/server'
import { advance, startSession, type SessionState } from '@/lib/flow-engine'
import { getFlowsBundle } from '@/lib/flow-db'

// Simulador: roda TODOS os fluxos (pra "Conexão de fluxo" funcionar),
// começando pelo fluxo de entrada (ativo).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const state: SessionState | null = body?.state ?? null
  const input: string = body?.input ?? ''

  const { flows, entryId } = await getFlowsBundle()
  const result = state ? advance(flows, state, input) : startSession(flows, entryId)
  return NextResponse.json(result)
}
