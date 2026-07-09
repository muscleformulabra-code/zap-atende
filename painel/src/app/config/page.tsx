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
