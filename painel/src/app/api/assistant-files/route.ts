import { NextResponse } from 'next/server'
import { currentMembership } from '@/lib/company'
import { getAssistant, updateAssistant } from '@/lib/assistants-db'
import type { AssistantFile } from '@/lib/assistant'

export const runtime = 'nodejs' // pdf-parse precisa do runtime Node

const SB = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY

const PER_FILE_CHARS = 15000 // corta arquivos gigantes (mantém o custo/contexto ok)

// Extrai texto do arquivo (best-effort). PDFs escaneados (imagem) não têm texto.
async function extractText(buf: Buffer, type: string, name: string): Promise<string> {
  const t = (type || '').toLowerCase()
  const n = (name || '').toLowerCase()
  if (t.startsWith('text/') || n.endsWith('.txt') || n.endsWith('.csv') || n.endsWith('.md') || t === 'application/json') {
    return buf.toString('utf8')
  }
  if (t === 'application/pdf' || n.endsWith('.pdf')) {
    try {
      // Importa o lib direto (evita o bug de "test mode" do index do pdf-parse).
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>
      const d = await pdfParse(buf)
      return d.text || ''
    } catch {
      return ''
    }
  }
  return '' // formato não suportado (ex.: docx/xlsx) — orienta colar no contexto
}

// Rebuild do campo knowledge a partir da lista de arquivos (guardamos o texto
// junto no metadado pra reconstruir ao remover).
type FileMeta = AssistantFile & { text?: string }
function joinKnowledge(files: FileMeta[]): string {
  return files.map((f) => `### ${f.name}\n${f.text || ''}`).join('\n\n').trim()
}

export async function POST(req: Request) {
  const m = await currentMembership()
  if (!m || (m.perms && !m.perms.config)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const assistantId = String(form?.get('assistantId') || '')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'arquivo obrigatório' }, { status: 400 })
  if (!assistantId) return NextResponse.json({ error: 'assistantId obrigatório' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'arquivo muito grande (máx. 5 MB)' }, { status: 400 })

  const a = await getAssistant(assistantId)
  if (!a) return NextResponse.json({ error: 'assistente não encontrado' }, { status: 404 })

  const buf = Buffer.from(await file.arrayBuffer())
  const text = (await extractText(buf, file.type, file.name)).slice(0, PER_FILE_CHARS).trim()

  // Sobe o arquivo pro Storage (bucket flyers).
  const safe = (file.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `assistants/${assistantId}/${Date.now()}_${safe}`
  let url = ''
  try {
    const up = await fetch(`${SB}/storage/v1/object/flyers/${path}`, {
      method: 'POST',
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: buf,
    })
    if (up.ok) url = `${SB}/storage/v1/object/public/flyers/${path}`
  } catch {}

  // Atualiza a lista de arquivos + reconstrói o knowledge.
  const files: FileMeta[] = [...(a.files as FileMeta[]), { name: file.name, url, chars: text.length, text }]
  const knowledge = joinKnowledge(files)
  await updateAssistant(assistantId, { files: files as AssistantFile[], knowledge })

  return NextResponse.json({
    ok: true,
    warn: text.length === 0 ? 'Não consegui ler texto desse arquivo (pode ser PDF escaneado/imagem). Cole o conteúdo no campo Contexto.' : null,
    files: files.map((f) => ({ name: f.name, url: f.url, chars: f.chars })),
  })
}

// Remove um arquivo (por índice) e reconstrói o knowledge.
export async function DELETE(req: Request) {
  const m = await currentMembership()
  if (!m || (m.perms && !m.perms.config)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const url = new URL(req.url)
  const assistantId = url.searchParams.get('assistantId') || ''
  const idx = Number(url.searchParams.get('index'))
  const a = await getAssistant(assistantId)
  if (!a) return NextResponse.json({ error: 'assistente não encontrado' }, { status: 404 })
  const files = (a.files as FileMeta[]).filter((_, i) => i !== idx)
  await updateAssistant(assistantId, { files: files as AssistantFile[], knowledge: joinKnowledge(files) })
  return NextResponse.json({ ok: true, files: files.map((f) => ({ name: f.name, url: f.url, chars: f.chars })) })
}
