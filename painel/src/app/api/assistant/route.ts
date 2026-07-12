import { NextResponse } from 'next/server'
import { getOpenAIKey } from '@/lib/settings-db'
import { getAssistant, listAssistants } from '@/lib/assistants-db'
import { buildSystemPrompt } from '@/lib/assistant'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Proxy seguro pra OpenAI: o navegador nunca vê a chave. Recebe as mensagens
// da conversa + o id do assistente, injeta as instruções/conhecimento dele e
// devolve a sugestão de resposta.
export async function POST(req: Request) {
  const { messages, assistantId } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[]; assistantId?: string }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Sem mensagens' }, { status: 400 })
  }

  const key = await getOpenAIKey()
  if (!key) {
    return NextResponse.json({ error: 'A chave da OpenAI ainda não foi configurada. Vá em Configurações → Integrações e cole sua chave (sk-...).' }, { status: 400 })
  }

  // Assistente escolhido (ou o primeiro da empresa).
  const a = assistantId ? await getAssistant(assistantId) : (await listAssistants())[0]
  if (!a) return NextResponse.json({ error: 'Nenhum assistente configurado.' }, { status: 400 })

  const convo = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: a.model,
        temperature: a.temperature,
        messages: [{ role: 'system', content: buildSystemPrompt(a) }, ...convo],
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return NextResponse.json({ error: d?.error?.message || `OpenAI erro ${r.status}` }, { status: 502 })
    return NextResponse.json({ reply: d?.choices?.[0]?.message?.content?.trim() || '' })
  } catch (e) {
    return NextResponse.json({ error: 'Falha ao falar com a OpenAI: ' + (e as Error).message }, { status: 502 })
  }
}
