import { NextResponse } from 'next/server'
import { deleteMessageRow } from '@/lib/db'
import { currentCompanyId } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Apaga uma mensagem NOSSA: apaga no WhatsApp (delete for everyone) e remove do
// nosso banco. Só mensagens enviadas por nós (o WhatsApp não deixa apagar as do
// paciente).
export async function POST(req: Request) {
  const { messageId } = await req.json().catch(() => ({}))
  if (!messageId) return NextResponse.json({ error: 'messageId obrigatório' }, { status: 400 })

  const row = await deleteMessageRow(messageId)
  // Se tinha id do WhatsApp, manda o conector apagar lá também.
  if (row?.wa_message_id && row.jid) {
    const company = await currentCompanyId()
    fetch(`${CONNECTOR_URL}/delete-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: row.jid, waMessageId: row.wa_message_id, company }),
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
