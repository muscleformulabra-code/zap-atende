'use client'

import { useEffect, useState } from 'react'

export default function IntegrationsPanel() {
  const [status, setStatus] = useState<{ configured: boolean; preview: string | null; fromEnv: boolean } | null>(null)
  const [key, setKey] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setStatus(await (await fetch('/api/integrations')).json())
  }
  useEffect(() => { load() }, [])

  async function salvar() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openaiKey: key }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'erro')
      setKey(''); setEditing(false); setMsg('✅ chave salva com segurança')
      load()
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  async function remover() {
    if (!confirm('Remover a chave da OpenAI? O Assistente de Leads vai parar de funcionar.')) return
    await fetch('/api/integrations', { method: 'DELETE' })
    setMsg(''); load()
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-lg text-white">🤖</span>
          <div>
            <div className="font-semibold text-gray-800">OpenAI <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Assistente de Leads</span></div>
            <div className="text-xs text-gray-500">Cole a chave da sua conta OpenAI (formato <code className="rounded bg-gray-100 px-1">sk-…</code>) para o Assistente de Leads funcionar.</div>
          </div>
        </div>

        {!status ? (
          <div className="mt-4 text-sm text-gray-400">carregando…</div>
        ) : status.configured && !editing ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
            <span className="text-lg">✅</span>
            <div className="flex-1 text-sm text-emerald-800">
              Chave configurada <span className="font-mono text-emerald-600">{status.preview}</span>
              {status.fromEnv && <span className="ml-1 text-xs text-emerald-600">(via variável de ambiente)</span>}
            </div>
            <button onClick={() => setEditing(true)} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">Trocar chave</button>
            {!status.fromEnv && <button onClick={remover} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Remover</button>}
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Chave da API OpenAI</label>
            <div className="mt-1 flex gap-2">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="flex-1 rounded-lg border border-gray-300 p-2.5 font-mono text-sm outline-none focus:border-emerald-500"
              />
              <button onClick={salvar} disabled={busy || !key.trim()} className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                {busy ? 'salvando…' : 'Salvar'}
              </button>
              {editing && <button onClick={() => { setEditing(false); setKey('') }} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:underline">cancelar</button>}
            </div>
            <p className="mt-2 text-xs text-gray-400">🔒 A chave fica <b>só no servidor</b> (protegida) e nunca aparece de volta aqui. Pegue a sua em platform.openai.com → API keys.</p>
          </div>
        )}
        {msg && <div className="mt-3 text-sm text-gray-600">{msg}</div>}
      </section>
    </div>
  )
}
