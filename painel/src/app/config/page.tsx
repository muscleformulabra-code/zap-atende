'use client'

import { useEffect, useState, type ReactNode } from 'react'
import EquipePanel from '@/components/equipe-panel'
import LabelsPanel from './labels-panel'
import QuickRepliesPanel from './quick-replies-panel'
import FlowDefaultsPanel from './flow-defaults-panel'
import IntegrationsPanel from './integrations-panel'
import AiAttendantPanel from './ai-attendant-panel'
import { type Antiban } from '@/lib/antiban'

type Settings = {
  bot_enabled: boolean
  company_name: string
  min_delay_ms: number
  max_delay_ms: number
  call_reject_enabled: boolean
  call_reject_message: string | null
  antiban: Antiban
}

const CALL_MSG_PADRAO =
  'Olá! 👋 Vi que você tentou ligar. Aqui neste número a gente atende *somente por mensagem* — não conseguimos atender chamadas. 😊\nPode me mandar sua dúvida por escrito que já te respondo por aqui!'

type Tab = 'conexao' | 'fluxos' | 'ia' | 'etiquetas' | 'respostas' | 'equipe' | 'integracoes' | 'robo' | 'companhia'
const MENU: { k: Tab; label: string }[] = [
  { k: 'conexao', label: 'Conexão' },
  { k: 'fluxos', label: 'Fluxos Padrões' },
  { k: 'ia', label: '🤖 Atendente IA' },
  { k: 'etiquetas', label: 'Etiquetas' },
  { k: 'respostas', label: 'Respostas rápidas' },
  { k: 'equipe', label: 'Equipe' },
  { k: 'integracoes', label: 'Integrações' },
  { k: 'robo', label: 'Robô' },
  { k: 'companhia', label: 'Companhia' },
]

export default function Config() {
  const [s, setS] = useState<Settings | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading')
  const [tab, setTab] = useState<Tab>('conexao')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => { setS(data); setStatus('ready') })
    // A aba Integrações (chave OpenAI) é só pra dono/admin.
    fetch('/api/me').then((r) => r.json()).then((d) => { setIsAdmin(!!d?.admin) }).catch(() => setIsAdmin(false))
  }, [])

  // Se um atendente comum cair na aba Integrações (ex.: link antigo), volta pra Conexão.
  useEffect(() => { if (!isAdmin && tab === 'integracoes') setTab('conexao') }, [isAdmin, tab])

  function up(patch: Partial<Settings>) { setS((cur) => (cur ? { ...cur, ...patch } : cur)) }
  function setAb(patch: Partial<Antiban>) { setS((cur) => (cur ? { ...cur, antiban: { ...cur.antiban, ...patch } } : cur)) }

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
  const Head = ({ title, save }: { title: string; save?: boolean }) => (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {save && <SaveBtn />}
    </div>
  )

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* SUB-MENU */}
        <nav className="w-full shrink-0 space-y-1 md:w-52">
          {MENU.filter((m) => m.k !== 'integracoes' || isAdmin).map((m) => (
            <button key={m.k} onClick={() => setTab(m.k)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${tab === m.k ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
              {m.label}
            </button>
          ))}
        </nav>

        {/* CONTEÚDO */}
        <div className="min-w-0 flex-1">
          {tab === 'conexao' ? (
            <div><Head title="Conexão" /><WhatsAppConnection companyName={s?.company_name} /></div>
          ) : tab === 'fluxos' ? (
            <div><Head title="Fluxos Padrões" /><FlowDefaultsPanel /></div>
          ) : tab === 'ia' ? (
            <div><Head title="🤖 Atendente IA (Sofia)" /><AiAttendantPanel /></div>
          ) : tab === 'etiquetas' ? (
            <div><Head title="Etiquetas" /><LabelsPanel /></div>
          ) : tab === 'respostas' ? (
            <div><Head title="Respostas rápidas" /><QuickRepliesPanel /></div>
          ) : tab === 'equipe' ? (
            <div><Head title="Equipe" /><EquipePanel /></div>
          ) : tab === 'integracoes' ? (
            isAdmin ? <div><Head title="Integrações" /><IntegrationsPanel /></div> : <div className="text-sm text-gray-400">Apenas administradores da conta podem ver a chave de integração.</div>
          ) : !s ? (
            <div className="text-sm text-gray-400">carregando…</div>
          ) : tab === 'robo' ? (
            <div>
              <Head title="Robô" save />
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
                  <div className="mt-1 text-xs text-gray-500">Deixa os envios do robô com cara de humano (parece gente digitando, evita bloqueio). Só afeta o robô/IA — mensagem sua no inbox sai na hora.</div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">Espera antes de responder: entre</span>
                    <input type="number" min={300} max={20000} step={100} value={s.min_delay_ms} onChange={(e) => up({ min_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
                    <span className="text-gray-500">e</span>
                    <input type="number" min={500} max={30000} step={100} value={s.max_delay_ms} onChange={(e) => up({ max_delay_ms: Number(e.target.value) })} className="w-24 rounded-lg border border-gray-300 p-1.5" />
                    <span className="text-gray-500">ms</span>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                    <AbRow title="Curva de sino no atraso" hint="Concentra o tempo de espera no meio (mais humano que aleatório puro)." on={s.antiban.gaussianJitter} onToggle={() => setAb({ gaussianJitter: !s.antiban.gaussianJitter })} />

                    <AbRow title="Digitação proporcional" hint="Respostas maiores levam mais tempo “digitando”, como uma pessoa." on={s.antiban.typingRealism} onToggle={() => setAb({ typingRealism: !s.antiban.typingRealism })}>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>velocidade</span>
                        <input type="number" min={15} max={120} step={5} value={s.antiban.typingWpm} onChange={(e) => setAb({ typingWpm: Number(e.target.value) })} className="w-20 rounded-lg border border-gray-300 p-1.5" />
                        <span>palavras/min · teto</span>
                        <input type="number" min={1} max={30} step={1} value={Math.round(s.antiban.typingMaxMs / 1000)} onChange={(e) => setAb({ typingMaxMs: Number(e.target.value) * 1000 })} className="w-16 rounded-lg border border-gray-300 p-1.5" />
                        <span>s</span>
                      </div>
                    </AbRow>

                    <AbRow title="Ritmo de madrugada" hint="Entre 0h e 6h responde mais devagar (parece gente dormindo)." on={s.antiban.circadian} onToggle={() => setAb({ circadian: !s.antiban.circadian })}>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>multiplicar espera por</span>
                        <input type="number" min={1} max={10} step={0.5} value={s.antiban.nightFactor} onChange={(e) => setAb({ nightFactor: Number(e.target.value) })} className="w-16 rounded-lg border border-gray-300 p-1.5" />
                        <span>×</span>
                      </div>
                    </AbRow>

                    <AbRow title="Pausa anti-rajada" hint="Depois de muitos envios num curto período (ex.: pico de campanha), descansa um tempo. Mensagens espaçadas do dia a dia raramente ativam isso." on={s.antiban.burstEnabled} onToggle={() => setAb({ burstEnabled: !s.antiban.burstEnabled })}>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>a cada</span>
                        <input type="number" min={5} max={500} step={5} value={s.antiban.burstLimit} onChange={(e) => setAb({ burstLimit: Number(e.target.value) })} className="w-20 rounded-lg border border-gray-300 p-1.5" />
                        <span>envios em</span>
                        <input type="number" min={1} max={120} step={1} value={Math.round(s.antiban.burstWindowMs / 60000)} onChange={(e) => setAb({ burstWindowMs: Number(e.target.value) * 60000 })} className="w-16 rounded-lg border border-gray-300 p-1.5" />
                        <span>min, descansa de</span>
                        <input type="number" min={1} max={120} step={1} value={Math.round(s.antiban.restMinMs / 60000)} onChange={(e) => setAb({ restMinMs: Number(e.target.value) * 60000 })} className="w-16 rounded-lg border border-gray-300 p-1.5" />
                        <span>a</span>
                        <input type="number" min={1} max={120} step={1} value={Math.round(s.antiban.restMaxMs / 60000)} onChange={(e) => setAb({ restMaxMs: Number(e.target.value) * 60000 })} className="w-16 rounded-lg border border-gray-300 p-1.5" />
                        <span>min</span>
                      </div>
                    </AbRow>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <label className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-800">📵 Recusar ligações e avisar</div>
                      <div className="text-xs text-gray-500">Quando um paciente ligar (voz ou vídeo), o robô recusa a chamada e manda uma mensagem automática.</div>
                    </div>
                    <button onClick={() => up({ call_reject_enabled: !s.call_reject_enabled })} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${s.call_reject_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${s.call_reject_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  {s.call_reject_enabled && (
                    <div className="mt-4">
                      <div className="mb-1 text-xs font-medium text-gray-600">Mensagem enviada ao paciente:</div>
                      <textarea
                        value={s.call_reject_message ?? ''}
                        onChange={(e) => up({ call_reject_message: e.target.value })}
                        placeholder={CALL_MSG_PADRAO}
                        rows={4}
                        className="w-full resize-y rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500"
                      />
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                        <span>Deixe em branco pra usar a mensagem padrão. Use *texto* pra <b>negrito</b>.</span>
                        {(s.call_reject_message ?? '') !== '' && (
                          <button onClick={() => up({ call_reject_message: '' })} className="text-emerald-600 hover:underline">restaurar padrão</button>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-400">Anti-spam: no máximo 1 aviso a cada 10 min por contato.</div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div>
              <Head title="Companhia" save />
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

// ── Linha de salvaguarda anti-ban: título + explicação + liga/desliga + extras ──
function AbRow({ title, hint, on, onToggle, children }: { title: string; hint: string; on: boolean; onToggle: () => void; children?: ReactNode }) {
  return (
    <div>
      <label className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-800">{title}</div>
          <div className="text-xs text-gray-500">{hint}</div>
        </div>
        <button onClick={onToggle} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </label>
      {on && children}
    </div>
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

// Formata o número do WhatsApp (556130463356 → +55 61 3046-3356).
function fmtPhone(raw: string): string {
  const n = String(raw).replace(/\D/g, '')
  const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/)
  if (m) return `+55 ${m[1]} ${m[2]}-${m[3]}`
  return '+' + n
}

// ── Seção: Conexão do WhatsApp (QR code que se renova sozinho + status ao vivo) ──
function WhatsAppConnection({ companyName }: { companyName?: string }) {
  const [wa, setWa] = useState<boolean | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [qrTick, setQrTick] = useState(0)
  const [hasQr, setHasQr] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = () => fetch('/api/status').then((r) => r.json()).then((d) => { if (alive) { setWa(!!d.whatsapp); setMe(d.me ?? null) } }).catch(() => alive && setWa(false))
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
            {wa && me ? (
              <div className="text-xs font-medium text-gray-600">
                O número de WhatsApp <span className="font-bold text-emerald-600">{fmtPhone(me)}</span> está conectado{companyName ? <> à <span className="font-semibold text-gray-700">{companyName}</span></> : ''}
              </div>
            ) : (
              <div className={`text-xs font-medium ${wa ? 'text-emerald-600' : wa === false ? 'text-red-500' : 'text-gray-400'}`}>{label}</div>
            )}
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
