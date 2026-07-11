import { NextResponse } from 'next/server'

const SB = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY

// Sobe um arquivo (imagem/vídeo/pdf/áudio) para o Supabase Storage (bucket
// público "flyers") e devolve o link público — usado pelos blocos de mídia
// do construtor.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'arquivo obrigatório' }, { status: 400 })
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'arquivo muito grande (máx. 50 MB)' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const safe = (file.name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `media/${Date.now()}_${safe}`

  const r = await fetch(`${SB}/storage/v1/object/flyers/${path}`, {
    method: 'POST',
    headers: {
      apikey: KEY!,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buf,
  })
  if (!r.ok) return NextResponse.json({ error: 'falha no upload: ' + (await r.text()).slice(0, 120) }, { status: 500 })

  return NextResponse.json({ url: `${SB}/storage/v1/object/public/flyers/${path}`, name: file.name })
}
