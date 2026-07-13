import { NextResponse } from 'next/server'
import { getAiAttendant, getOpenAIKey } from '@/lib/settings-db'
import { buildAiPrompt, isOpenNow } from '@/lib/ai-attendant'

// Chamado pelo CONECTOR: dado um contato, a Sofia lê o histórico da conversa,
// pensa e devolve { message, handoff }. O conector envia a mensagem e, se
// handoff=true, passa a conversa pro atendente humano.
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_KEY
const REST = `${SUPABASE_URL}/rest/v1`
const H = { apikey: SERVICE || '', Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

type Turn = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  const { contactId, company } = (await req.json().catch(() => ({}))) as { contactId?: string; company?: string }
  if (!contactId || !company) return NextResponse.json({ enabled: false })

  const cfg = await getAiAttendant(company)
  if (!cfg.enabled) return NextResponse.json({ enabled: false })

  const key = await getOpenAIKey(company)
  // Sem chave configurada → passa pro humano (não deixa o paciente no vácuo).
  if (!key) return NextResponse.json({ enabled: true, handoff: true, message: '', reason: 'sem chave OpenAI' })

  // Histórico recente da conversa (paciente = user, clínica = assistant).
  let convo: Turn[] = []
  try {
    const r = await fetch(`${REST}/messages?company_id=eq.${company}&contact_id=eq.${contactId}&select=from_me,text,sent_at&order=sent_at.desc&limit=24`, { headers: H, cache: 'no-store' })
    const rows: { from_me: boolean; text: string | null }[] = r.ok ? await r.json() : []
    convo = rows
      .reverse()
      .filter((m) => m.text && m.text.trim() && !/^\[.*\]$/.test(m.text.trim())) // ignora rótulos tipo [imagem]
      .map((m) => ({ role: m.from_me ? 'assistant' : 'user', content: m.text as string }))
  } catch {
    /* segue sem histórico */
  }
  if (!convo.length) return NextResponse.json({ enabled: true, handoff: false, message: '' })

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: buildAiPrompt(cfg) }, ...convo],
      }),
    })
    const d = await resp.json().catch(() => ({}))
    if (!resp.ok) return NextResponse.json({ enabled: true, handoff: true, message: '', reason: d?.error?.message || `openai ${resp.status}` })

    const raw = d?.choices?.[0]?.message?.content || '{}'
    let parsed: { message?: string; handoff?: boolean; reason?: string } = {}
    try { parsed = JSON.parse(raw) } catch { parsed = { message: raw } }

    let message = String(parsed.message || '').trim()
    const handoff = !!parsed.handoff
    // Se vai passar pro humano E está fora do horário, acrescenta o aviso.
    if (handoff && !isOpenNow(cfg.hours)) {
      message = [message, cfg.handoff.offHoursMessage].filter(Boolean).join('\n\n')
    }
    return NextResponse.json({ enabled: true, handoff, message, reason: parsed.reason || '' })
  } catch (e) {
    return NextResponse.json({ enabled: true, handoff: true, message: '', reason: 'falha OpenAI: ' + (e as Error).message })
  }
}
