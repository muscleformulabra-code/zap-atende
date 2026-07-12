import { NextResponse } from 'next/server'
import { getOpenAIKey, getAssistantConfigRaw } from '@/lib/settings-db'
import { normalizeAssistantConfig, buildSystemPrompt } from '@/lib/assistant'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

// Proxy seguro pra OpenAI: o navegador nunca vê a chave. Recebe as mensagens
// da conversa, injeta o system prompt e devolve a sugestão de resposta.
export async function POST(req: Request) {
  const { messages } = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[] }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Sem mensagens' }, { status: 400 })
  }

  const key = await getOpenAIKey()
  if (!key) {
    return NextResponse.json({ error: 'A chave da OpenAI ainda não foi configurada. Vá em Configurações → Integrações e cole sua chave (sk-...).' }, { status: 400 })
  }

  // Config editável na tela (nome, instruções, modelo, temperatura, contexto).
  const cfg = normalizeAssistantConfig(await getAssistantConfigRaw())

  // Só as últimas ~20 mensagens (contexto suficiente, custo controlado).
  const convo = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        messages: [{ role: 'system', content: buildSystemPrompt(cfg) }, ...convo],
      }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) {
      const msg = d?.error?.message || `OpenAI erro ${r.status}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }
    const reply = d?.choices?.[0]?.message?.content?.trim() || ''
    return NextResponse.json({ reply })
  } catch (e) {
    return NextResponse.json({ error: 'Falha ao falar com a OpenAI: ' + (e as Error).message }, { status: 502 })
  }
}
