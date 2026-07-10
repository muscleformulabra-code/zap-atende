import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getContactJid, setHandoff } from '@/lib/db'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Envia mídia (foto/vídeo/pdf) pelo WhatsApp a partir do inbox.
// O arquivo chega em base64 (dataUrl) e é repassado ao conector.
export async function POST(req: Request) {
  const { contactId, kind, dataUrl, fileName, caption } = await req.json().catch(() => ({}))
  if (!contactId || !dataUrl) return NextResponse.json({ error: 'contactId e dataUrl obrigatórios' }, { status: 400 })

  const jid = await getContactJid(contactId)
  if (!jid) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })

  const sentBy = (await cookies()).get('za_email')?.value || null
  await setHandoff(contactId).catch(() => {})

  try {
    const r = await fetch(`${CONNECTOR_URL}/send-media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: jid, kind, dataUrl, fileName, caption, sentBy, contactId }),
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return NextResponse.json({ ok: false, warn: `conector: ${e.error || r.status}` })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, warn: 'conector offline (mídia não enviada)' })
  }
}
