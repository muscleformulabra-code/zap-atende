import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getContactJid, setHandoff } from '@/lib/db'
import { getUserName } from '@/lib/auth'
import { membershipByEmail } from '@/lib/company'

// Endereço do conector (WhatsApp). Padrão = conector na nuvem (Railway); pode
// sobrescrever com a env CONNECTOR_URL (ex.: http://localhost:3333 em dev local).
const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Envia uma mensagem pelo WhatsApp (via conector) a partir do inbox,
// atribuindo ao atendente logado (para o ranking de atendentes).
export async function POST(req: Request) {
  const { contactId, text } = await req.json().catch(() => ({}))
  if (!contactId || !text) return NextResponse.json({ error: 'contactId e text obrigatórios' }, { status: 400 })

  const jid = await getContactJid(contactId)
  if (!jid) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })

  const sentBy = (await cookies()).get('za_email')?.value || null

  // Prefixa com o nome do atendente (ex.: "*Isabella Martins:*\nmensagem") pra
  // o paciente saber com quem está falando — igual BotConversa. Usa o nome do
  // PERFIL (membership); se não tiver, cai no metadata/derivado do e-mail.
  const name = sentBy
    ? (await membershipByEmail(sentBy).catch(() => null))?.name || (await getUserName(sentBy).catch(() => null))
    : null
  const outgoing = name ? `*${name}:*\n${text}` : text

  // Atendente assumiu → bot para de responder esse contato.
  await setHandoff(contactId).catch(() => {})

  try {
    const r = await fetch(`${CONNECTOR_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: jid, text: outgoing, sentBy, contactId }),
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
