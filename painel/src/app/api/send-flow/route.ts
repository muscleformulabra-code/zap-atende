import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getContactJid, setFlowSession } from '@/lib/db'
import { getFlowsBundle } from '@/lib/flow-db'
import { startSession } from '@/lib/flow-engine'
import { currentCompanyId } from '@/lib/company'

const CONNECTOR_URL = process.env.CONNECTOR_URL || 'https://zap-atende-production.up.railway.app'

// Dispara um fluxo específico para um contato a partir do inbox:
// roda o motor desde o início do fluxo escolhido, envia as respostas pelo
// WhatsApp (conector) e grava a posição da sessão pra automação continuar.
export async function POST(req: Request) {
  const { contactId, flowId } = await req.json().catch(() => ({}))
  if (!contactId || !flowId) return NextResponse.json({ error: 'contactId e flowId obrigatórios' }, { status: 400 })

  const jid = await getContactJid(contactId)
  if (!jid) return NextResponse.json({ error: 'contato não encontrado' }, { status: 404 })

  const { flows } = await getFlowsBundle()
  if (!flows[flowId]) return NextResponse.json({ error: 'fluxo não encontrado' }, { status: 404 })

  const { replies, state } = startSession(flows, flowId)
  const sentBy = (await cookies()).get('za_email')?.value || null
  const company = await currentCompanyId()

  // Grava a posição já (mesmo se a automação parar num menu/handoff).
  await setFlowSession(contactId, { flowId: state.flowId, currentNode: state.currentNode, status: state.status }).catch(() => {})

  let warn: string | null = null
  for (const r of replies) {
    const text = r.text ?? r.caption ?? ''
    if (!text && !r.image) continue
    try {
      const res = await fetch(`${CONNECTOR_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: jid, text: r.image ? `${text}\n${r.image}`.trim() : text, sentBy, contactId, company }),
      })
      if (!res.ok) { warn = 'conector recusou o envio'; break }
    } catch {
      warn = 'conector offline (fluxo não enviado ao WhatsApp)'
      break
    }
  }

  return NextResponse.json({ ok: !warn, warn, sent: replies.length, status: state.status })
}
