import { NextResponse } from 'next/server'
import { getOpenAIKey } from '@/lib/settings-db'

// Chamado pelo CONECTOR: recebe a URL de um áudio (no Storage) + a empresa,
// transcreve com o Whisper da OpenAI e devolve o texto. Assim a IA "ouve" o
// paciente. A chave da OpenAI fica sempre no servidor.
export async function POST(req: Request) {
  const { url, company } = (await req.json().catch(() => ({}))) as { url?: string; company?: string }
  if (!url || !company) return NextResponse.json({ text: '' })

  const key = await getOpenAIKey(company)
  if (!key) return NextResponse.json({ text: '' })

  try {
    const audio = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!audio.ok) return NextResponse.json({ text: '' })
    const buf = await audio.arrayBuffer()

    const form = new FormData()
    form.append('file', new Blob([buf]), 'audio.ogg')
    form.append('model', 'whisper-1')
    form.append('language', 'pt')

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ text: '', error: d?.error?.message || `whisper ${r.status}` })
    return NextResponse.json({ text: String(d?.text || '').trim() })
  } catch (e) {
    return NextResponse.json({ text: '', error: (e as Error).message })
  }
}
