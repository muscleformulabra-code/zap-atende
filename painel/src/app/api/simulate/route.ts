import { NextResponse } from 'next/server'
import { advance, startSession, type SessionState } from '@/lib/flow-engine'
import { getFlowsBundle, bumpFlowMetric } from '@/lib/flow-db'

// Simulador: roda TODOS os fluxos (pra "Conexão de fluxo" funcionar),
// começando pelo fluxo de entrada (ativo).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const state: SessionState | null = body?.state ?? null
  const input: string = body?.input ?? ''
  const startFlowId: string | null = body?.startFlowId ?? null
  const company: string | undefined = body?.company ?? undefined // conector passa a empresa
  // Só o BOT REAL conta métricas. O construtor/simulador não manda company nem
  // track, então não infla os números.
  const track: boolean = body?.track === true || !!company

  const { flows, entryId } = await getFlowsBundle(company)
  // startFlowId = dispara um fluxo específico (resposta padrão / mídia).
  // Sem ele: avança a sessão, ou começa pelo fluxo de entrada (boas-vindas).
  if (state) {
    const result = advance(flows, state, input)
    // Connection = o paciente respondeu válido e avançou dentro do fluxo.
    if (track && !result.invalid && result.state?.flowId) bumpFlowMetric(result.state.flowId, 0, 1)
    return NextResponse.json(result)
  }
  const startId = startFlowId && flows[startFlowId] ? startFlowId : entryId
  const result = startSession(flows, startId)
  if (track && startId) bumpFlowMetric(startId, 1, 0) // execução = entrou no fluxo
  return NextResponse.json(result)
}
