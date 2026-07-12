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

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

type Tab = 'conexao' | 'horarios' | 'robo' | 'companhia'
const MENU: { k: Tab; label: string }[] = [
  { k: 'conexao', label: 'Conexão' },
  { k: 'horarios', label: 'Horários' },
  { k: 'robo', label: 'Robô' },
  { k: 'companhia', label: 'Companhia' },
]
const LINKS: { href: string; label: string }[] = [
  { href: '/contatos', label: 'Etiquetas' },
  { href: '/respostas', label: 'Respostas rápidas' },
  { href: '/equipe', label: 'Equipe' },
  { href: '/fluxos', label: 'Fluxos' },
]

export default function Config() {
  const [s, setS] = useState<Settings | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')
  const [tab, setTab] = useState<Tab>('conexao')

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => { setS(data); setStatus('ready') })
  }, [])

  function up(patch: Partial<Settings>) { setS((cur) => (cur ? { ...cur, ...patch } : cur)) }
  function upHours(patch: Partial<Hours>) { setS((cur) => (cur ? { ...cur, hours: { ...cur.hours, ...patch } } : cur)) }
  function toggleDay(d: number) {
    if (!s) return
    const days = s.hours.days.includes(d) ? s.hours.days.filter((x) => x !== d) : [...s.hours.days, d].sort()
    upHours({ days })
  }

  async function save() {
    if (!s) return
    setStatus('saving')
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    setStatus('saved')
    setTimeout(() => setStatus('ready'), 1500)
  }

  const SaveBtn = () => (
    <button onClick={save} disabled={status === 'saving'} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
      {status === 'saving' ? 'salvando…' : status === 'saved' ? '✓ salvo' : 'Salvar'}
    </button>
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* SUB-MENU */}
        <nav className="w-full shrink-0 space-y-1 md:w-52">
          {MENU.map((m) => (
            <button key={m.k} onClick={() => setTab(m.k)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${tab === m.k ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              {m.label}
            </button>
          ))}
          <div className="my-2 border-t border-gray-100" />
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-800">
              {l.label}<span className="text-gray-300">↗</span>
            </a>
          ))}
        </nav>

        {/* CONTEÚDO */}
        <div className="min-w-0 flex-1">
          {!s ? (
            <div className="text-sm text-gray-400">carregando…</div>
          ) : tab === 'conexao' ? (
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Conexão</h2>
              <WhatsAppConnection />
            </div>
          ) : tab === 'horarios' ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Horários</h2>
                <SaveBtn />
              </div>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="font-medium text-gray-800">Horário de funcionamento</div>
                <p className="mt-1 text-xs text-gray-500">Fora desse horário, o bot manda a mensagem de fora do expediente em vez do fluxo.</p>
                <div className="mt-4 space-y-2">
                  {DIAS.map((nome, i) => {
                    const aberto = s.hours.days.includes(i)
                    return (
                      <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-100 px-4 py-2.5">
                        <span className="w-28 text-sm font-medium text-gray-700">{nome}</span>
                        <button onClick={() => toggleDay(i)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aberto ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${aberto ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                        <span className={`w-16 text-sm font-medium ${aberto ? 'text-emerald-600' : 'text-red-400'}`}>{aberto ? 'Aberto' : 'Fechado'}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 text-sm">
                  <span className="text-gray-500">Atende das</span>
                  <input type="time" value={s.hours.start} onChange={(e) => upHours({ start: e.target.value })} className="rounded-lg border border-gray-300 p-1.5" />
                  <span className="text-gray-500">às</span>
                  <input type="time" value={s.hours.end} onChange={(e) => upHours({ end: e.target.value })} className="rounded-lg border border-gray-300 p-1.5" />
                  <span className="text-xs text-gray-400">(vale pros dias abertos)</span>
                </div>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-gray-700">Mensagem fora do horário</span>
                  <textarea value={s.off_hours_message} onChange={(e) => up({ off_hours_message: e.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                </label>
              </section>
            </div>
          ) : tab === 'robo' ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Robô</h2>
                <SaveBtn />
              </div>
              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">Robô (chatbot) ligado</div>
                      <div className="text-xs text-gray-500">Se desligar, o bot para de responder automaticamente.</div>
                    </div>
                    <button onClick={() => up({ bot_enabled: !s.bot_enabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${s.bot_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${s.bot_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </section>
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="font-medium text-gray-800">🛡️ Salvaguardas anti-ban</div>
                  <div className="mt-1 text-xs text-gray-500">O bot espera um tempo aleatório entre respostas (parece humano, evita bloqueio).</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">entre</span>
                    <input type="number" min={300} max={20000} step={100} value={s.min_delay_ms} onChange={(e) => up({ min_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
                    <span className="text-gray-500">e</span>
                    <input type="number" min={500} max={30000} step={100} value={s.max_delay_ms} onChange={(e) => up({ max_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
                    <span className="text-gray-500">milissegundos</span>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Companhia</h2>
                <SaveBtn />
              </div>
              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Nome da empresa</span>
                    <input value={s.company_name} onChange={(e) => up({ company_name: e.target.value })} placeholder="Ex: Ricco Odontologia" className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />
                  </label>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
                    <span className="text-gray-500">Fuso horário</span>
                    <span className="font-medium text-gray-700">Brasília (America/São_Paulo, -03:00)</span>
                  </div>
                </section>

                <DangerZone />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

// ── Zona de perigo: excluir todos os contatos (exige digitar EXCLUIR) ──
function DangerZone() {
  const [open, setOpen] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function excluir() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/contacts/wipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: word }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'erro')
      setMsg(`✅ ${d.deleted} contato(s) excluído(s).`)
      setOpen(false); setWord('')
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5 shadow-sm">
      <div className="font-medium text-red-700">⚠️ Zona de perigo</div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-800">Excluir todos os contatos</div>
          <div className="text-xs text-gray-500">Apaga todos os contatos e conversas desta empresa. Não dá pra desfazer.</div>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Excluir…</button>}
      </div>
      {open && (
        <div className="mt-3 rounded-xl border border-red-200 bg-white p-3">
          <p className="text-xs text-gray-600">Digite <b>EXCLUIR</b> para confirmar:</p>
          <div className="mt-2 flex gap-2">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="EXCLUIR" className="w-40 rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-red-400" />
            <button onClick={excluir} disabled={busy || word !== 'EXCLUIR'} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40">{busy ? 'excluindo…' : 'Confirmar exclusão'}</button>
            <button onClick={() => { setOpen(false); setWord('') }} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:underline">cancelar</button>
          </div>
        </div>
      )}
      {msg && <div className="mt-3 text-sm text-gray-600">{msg}</div>}
    </section>
  )
}

// ── Seção: Conexão do WhatsApp (QR code que se renova sozinho + status ao vivo) ──
function WhatsAppConnection() {
  const [wa, setWa] = useState<boolean | null>(null)
  const [qrTick, setQrTick] = useState(0)
  const [hasQr, setHasQr] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = () => fetch('/api/status').then((r) => r.json()).then((d) => { if (alive) setWa(!!d.whatsapp) }).catch(() => alive && setWa(false))
    poll()
    const t = setInterval(poll, 4000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  useEffect(() => {
    if (wa !== false) return
    const t = setInterval(() => setQrTick((x) => x + 1), 4000)
    return () => clearInterval(t)
  }, [wa])

  async function reiniciar() {
    if (!confirm('Reiniciar a conexão? Use só se o QR não aparecer. Leva ~40s.')) return
    setResetting(true); setHasQr(false)
    await fetch('/api/connect', { method: 'POST' }).catch(() => {})
    setTimeout(() => setResetting(false), 42000)
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
            <div className="font-semibold text-gray-800">{wa ? 'Automação está ligada' : 'Conexão do WhatsApp'}</div>
            <div className={`text-xs font-medium ${wa ? 'text-emerald-600' : wa === false ? 'text-red-500' : 'text-gray-400'}`}>{label}</div>
          </div>
        </div>
        {wa === false && (
          <button onClick={reiniciar} disabled={resetting} className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {resetting ? 'Reiniciando…' : '↻ Reiniciar conexão'}
          </button>
        )}
      </div>

      {wa && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <span className="text-xl">✅</span>
          <div className="flex-1 text-sm text-emerald-800">Tudo certo! O robô está conectado e recebendo/enviando mensagens. A automação continua funcionando mesmo com o celular desligado.</div>
          <button onClick={reiniciar} className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100">Reconectar</button>
        </div>
      )}

      {wa === false && (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr?t=${qrTick}`} alt="QR code do WhatsApp" onLoad={() => setHasQr(true)} onError={() => setHasQr(false)} className={`h-56 w-56 rounded-xl bg-white p-2 shadow-sm ${hasQr ? '' : 'hidden'}`} />
          {!hasQr && (
            <div className="py-8 text-sm text-gray-500">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
              {resetting ? 'Reiniciando a conexão… (~40s)' : 'Gerando o QR… aparece em instantes.'}
            </div>
          )}
          {hasQr && (
            <p className="mt-3 max-w-xs text-sm text-gray-600">
              📱 No celular do <b>número do bot</b>: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> → escaneie o código. Ele se renova sozinho.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
