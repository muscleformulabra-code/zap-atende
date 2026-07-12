import { NextResponse } from 'next/server'
import { getMessageMeta, updateMessageText } from '@/lib/db'
import { currentCompanyId } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Edita uma mensagem NOSSA de texto: edita no WhatsApp e no nosso banco.
export async function POST(req: Request) {
  const { messageId, text } = await req.json().catch(() => ({}))
  if (!messageId || !text?.trim()) return NextResponse.json({ error: 'messageId e text obrigatórios' }, { status: 400 })
  const meta = await getMessageMeta(messageId)
  if (!meta) return NextResponse.json({ error: 'mensagem não encontrada' }, { status: 404 })

  await updateMessageText(messageId, text.trim())
  if (meta.wa_message_id) {
    const company = await currentCompanyId()
    fetch(`${CONNECTOR_URL}/edit-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: meta.jid, waMessageId: meta.wa_message_id, text: text.trim(), company }),
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
