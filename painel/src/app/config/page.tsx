'use client'

import { useEffect, useState } from 'react'

type Hours = { days: number[]; start: string; end: string }
type Settings = {
  bot_enabled: boolean
  company_name: string
  hours: Hours
  off_hours_message: string
  min_delay_ms: number
  max_delay_ms: number
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Config() {
  const [s, setS] = useState<Settings | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setS(data)
        setStatus('ready')
      })
  }, [])

  function up(patch: Partial<Settings>) {
    setS((cur) => (cur ? { ...cur, ...patch } : cur))
  }
  function upHours(patch: Partial<Hours>) {
    setS((cur) => (cur ? { ...cur, hours: { ...cur.hours, ...patch } } : cur))
  }
  function toggleDay(d: number) {
    if (!s) return
    const days = s.hours.days.includes(d) ? s.hours.days.filter((x) => x !== d) : [...s.hours.days, d].sort()
    upHours({ days })
  }

  async function save() {
    if (!s) return
    setStatus('saving')
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    setStatus('saved')
    setTimeout(() => setStatus('ready'), 1500)
  }

  if (!s) return <main className="p-8 text-sm text-gray-400">carregando…</main>

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-500">Comportamento do chatbot</p>
        </div>
        <button onClick={save} disabled={status === 'saving'} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar'}
        </button>
      </header>

      <div className="space-y-5">
        {/* Conexão do WhatsApp */}
        <WhatsAppConnection />

        {/* Robô ligado */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">Robô (chatbot) ligado</div>
              <div className="text-xs text-gray-500">Se desligar, o bot para de responder automaticamente.</div>
            </div>
            <input type="checkbox" checked={s.bot_enabled} onChange={(e) => up({ bot_enabled: e.target.checked })} className="h-5 w-5 accent-emerald-500" />
          </label>
        </section>

        {/* Empresa */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Nome da empresa</span>
            <input value={s.company_name} onChange={(e) => up({ company_name: e.target.value })} placeholder="Ex: Ricco Odontologia" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
        </section>

        {/* Horário */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="font-medium text-gray-800">Horário de atendimento</div>
          <div className="mt-1 text-xs text-gray-500">Fora desse horário, o bot manda a mensagem abaixo em vez do fluxo.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {DIAS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} className={`rounded-lg px-3 py-1 text-sm font-medium ${s.hours.days.includes(i) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                {d}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">das</span>
            <input type="time" value={s.hours.start} onChange={(e) => upHours({ start: e.target.value })} className="rounded-lg border border-gray-300 p-1.5" />
            <span className="text-gray-500">às</span>
            <input type="time" value={s.hours.end} onChange={(e) => upHours({ end: e.target.value })} className="rounded-lg border border-gray-300 p-1.5" />
          </div>
          <label className="mt-4 block">
            <span className="text-sm font-medium text-gray-700">Mensagem fora do horário</span>
            <textarea value={s.off_hours_message} onChange={(e) => up({ off_hours_message: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
          </label>
        </section>

        {/* Anti-ban */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="font-medium text-gray-800">🛡️ Salvaguardas anti-ban</div>
          <div className="mt-1 text-xs text-gray-500">O bot espera um tempo aleatório entre respostas (parece humano, evita bloqueio).</div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-gray-500">entre</span>
            <input type="number" min={300} max={20000} step={100} value={s.min_delay_ms} onChange={(e) => up({ min_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
            <span className="text-gray-500">e</span>
            <input type="number" min={500} max={30000} step={100} value={s.max_delay_ms} onChange={(e) => up({ max_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
            <span className="text-gray-500">milissegundos</span>
          </div>
        </section>
      </div>
    </main>
  )
}

// ── Seção: Conexão do WhatsApp (QR code + status ao vivo) ──
function WhatsAppConnection() {
  const [wa, setWa] = useState<boolean | null>(null) // conectado?
  const [qrTick, setQrTick] = useState(0)
  const [hasQr, setHasQr] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = () =>
      fetch('/api/status')
        .then((r) => r.json())
        .then((d) => { if (!alive) return; setWa(!!d.whatsapp); if (d.whatsapp) setGenerating(false) })
        .catch(() => alive && setWa(false))
    poll()
    const t = setInterval(poll, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    if (wa) return // conectado: não precisa de QR
    const t = setInterval(() => setQrTick((x) => x + 1), 6000)
    return () => clearInterval(t)
  }, [wa])

  async function gerar() {
    setGenerating(true); setHasQr(false); setWa(false)
    await fetch('/api/connect', { method: 'POST' }).catch(() => {})
    setTimeout(() => setQrTick((x) => x + 1), 4000)
  }

  const dot = wa == null ? 'bg-gray-300' : wa ? 'bg-emerald-500' : 'bg-red-400'
  const label = wa == null ? 'Verificando…' : wa ? 'WhatsApp conectado' : 'WhatsApp desconectado'

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            {wa && <span className="za-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${dot}`} />
          </span>
          <div>
            <div className="font-semibold text-gray-800">Conexão do WhatsApp</div>
            <div className={`text-xs font-medium ${wa ? 'text-emerald-600' : wa === false ? 'text-red-500' : 'text-gray-400'}`}>{label}</div>
          </div>
        </div>
        {wa === false && !generating && (
          <button onClick={gerar} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600">
            Gerar QR Code
          </button>
        )}
      </div>

      {wa && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <span className="text-xl">✅</span>
          <div className="flex-1 text-sm text-emerald-800">Tudo certo! O robô está conectado e recebendo/enviando mensagens.</div>
          <button onClick={() => { if (confirm('Isso desconecta o WhatsApp atual e gera um QR novo. Continuar?')) gerar() }} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100">
            Reconectar
          </button>
        </div>
      )}

      {wa === false && (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center">
          {generating && !hasQr ? (
            <div className="py-8 text-sm text-gray-500">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
              Gerando QR novo… aguarde ~40 segundos.
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr?t=${qrTick}`}
                alt="QR code do WhatsApp"
                onLoad={() => setHasQr(true)}
                onError={() => setHasQr(false)}
                className={`h-56 w-56 rounded-xl bg-white p-2 shadow-sm ${hasQr ? '' : 'hidden'}`}
              />
              {hasQr ? (
                <p className="mt-3 max-w-xs text-sm text-gray-600">
                  📱 No celular do <b>número do bot</b>: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> → escaneie o código acima.
                </p>
              ) : (
                <p className="py-8 text-sm text-gray-500">Clique em <b>Gerar QR Code</b> para conectar o WhatsApp.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
