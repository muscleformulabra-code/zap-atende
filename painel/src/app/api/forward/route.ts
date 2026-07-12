import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getMessageMeta, getContactJid } from '@/lib/db'
import { currentCompanyId } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Encaminha (reenvia o conteúdo de) uma mensagem para OUTRO contato.
export async function POST(req: Request) {
  const { messageId, targetContactId } = await req.json().catch(() => ({}))
  if (!messageId || !targetContactId) return NextResponse.json({ error: 'messageId e targetContactId obrigatórios' }, { status: 400 })

  const meta = await getMessageMeta(messageId)
  if (!meta) return NextResponse.json({ error: 'mensagem não encontrada' }, { status: 404 })
  const targetJid = await getContactJid(targetContactId)
  if (!targetJid) return NextResponse.json({ error: 'contato de destino não encontrado' }, { status: 404 })

  const sentBy = (await cookies()).get('za_email')?.value || null
  const company = await currentCompanyId()
  try {
    const r = await fetch(`${CONNECTOR_URL}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: targetJid, text: meta.text, mediaUrl: meta.media_url, mediaType: meta.media_type, sentBy, contactId: targetContactId, company }),
    })
    if (!r.ok) return NextResponse.json({ ok: false, warn: 'conector recusou o encaminhamento' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, warn: 'conector offline' })
  }
}
