import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getContactJid, setHandoff } from '@/lib/db'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'http://localhost:3333'

// Envia uma mensagem pelo WhatsApp (via conector) a partir do inbox,
// atribuindo ao atendente logado (para o ranking de atendentes).
export async function POST(req: Request) {
  const { contactId, text } = await req.json().catch(() => ({}))
  if (!contactId || !text) return NextResponse.json({ error: 'contactId e text obrigatórios' }, { status: 400 })

  const jid = await getContactJid(contactId)
  if (!jid) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })

  const sentBy = (await cookies()).get('za_email')?.value || null

  // Atendente assumiu → bot para de responder esse contato.
  await setHandoff(contactId).catch(() => {})

  try {
    const r = await fetch(`${CONNECTOR_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: jid, text, sentBy, contactId }),
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      return NextResponse.json({ ok: false, warn: `conector: ${e.error || r.status}` })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, warn: 'conector offline (mensagem não enviada ao WhatsApp)' })
  }
}
