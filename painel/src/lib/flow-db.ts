// Acesso aos FLUXOS no Supabase (via REST). Suporta vários fluxos.
// Guardamos o GRAFO visual em `definition`; o motor deriva na hora.
import { blankGraph, defaultGraph, graphToFlow, type FlowGraph } from './flow-graph'
import type { Flows } from './flow-engine'
import { currentCompanyId, SEED_COMPANY_ID } from './company'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY em painel/.env.local')
}

const REST = `${SUPABASE_URL}/rest/v1`
const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// Empresa do request (fluxos são isolados por empresa). SEED = fallback do
// conector (que hoje atende só a Empresa #1).
async function cid(explicit?: string): Promise<string> {
  return explicit ?? (await currentCompanyId()) ?? SEED_COMPANY_ID
}

export type FlowRow = {
  id: string
  name: string
  is_active: boolean
  definition: FlowGraph
  updated_at: string
}

async function req(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${REST}/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) }, cache: 'no-store' })
  if (!res.ok) throw new Error(`flows ${path} -> ${res.status}: ${await res.text()}`)
  return res
}

// Lista todos os fluxos da empresa. Na 1ª vez, cria o fluxo padrão (ativo).
export async function listFlows(): Promise<FlowRow[]> {
  const c = await cid()
  const rows: FlowRow[] = await (await req(`flows?company_id=eq.${c}&select=*&order=updated_at.desc`)).json()
  if (rows.length > 0) return rows
  const created: FlowRow[] = await (
    await req('flows', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: 'Pré-atendimento', is_active: true, definition: defaultGraph, company_id: c }),
    })
  ).json()
  return created
}

export async function getFlow(id: string): Promise<FlowRow | null> {
  const c = await cid()
  const rows: FlowRow[] = await (await req(`flows?id=eq.${id}&company_id=eq.${c}&select=*&limit=1`)).json()
  return rows[0] ?? null
}

export async function createFlow(name: string): Promise<FlowRow> {
  const c = await cid()
  const rows: FlowRow[] = await (
    await req('flows', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name, is_active: false, definition: blankGraph(), company_id: c }),
    })
  ).json()
  return rows[0]
}

export async function updateFlowDefinition(id: string, definition: FlowGraph): Promise<void> {
  const c = await cid()
  await req(`flows?id=eq.${id}&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ definition, updated_at: new Date().toISOString() }),
  })
}

export async function renameFlow(id: string, name: string): Promise<void> {
  const c = await cid()
  await req(`flows?id=eq.${id}&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ name, updated_at: new Date().toISOString() }),
  })
}

export async function deleteFlow(id: string): Promise<void> {
  const c = await cid()
  await req(`flows?id=eq.${id}&company_id=eq.${c}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
}

// Marca um fluxo como ativo (o que atende contatos novos) e desativa os outros
// DA MESMA EMPRESA (não mexe nos fluxos das outras).
export async function setActiveFlow(id: string): Promise<void> {
  const c = await cid()
  await req(`flows?is_active=eq.true&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: false }),
  })
  await req(`flows?id=eq.${id}&company_id=eq.${c}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_active: true }),
  })
}

// Pacote para o simulador/motor: todos os fluxos (mapa) + qual é a entrada.
export async function getFlowsBundle(): Promise<{ flows: Flows; entryId: string }> {
  const rows = await listFlows()
  const flows: Flows = {}
  for (const r of rows) flows[r.id] = graphToFlow(r.definition)
  const entry = rows.find((r) => r.is_active) ?? rows[0]
  return { flows, entryId: entry?.id ?? '' }
}
