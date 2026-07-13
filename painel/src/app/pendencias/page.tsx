'use client'

import { useCallback, useEffect, useState } from 'react'

type Pendencia = { contact_id: string; name: string | null; phone: string | null; last_text: string | null; last_sent_at: string | null; waitingMin: number }

// Faixa de prioridade pela espera (minutos).
function tier(min: number) {
  if (min >= 60) return { label: 'Crítico', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700', bar: 'border-l-red-500' }
  if (min >= 30) return { label: 'Alto', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700', bar: 'border-l-orange-400' }
  if (min >= 10) return { label: 'Médio', dot: 'bg-amber-400', chip: 'bg-amber-100 text-amber-700', bar: 'border-l-amber-400' }
  return { label: 'Recente', dot: 'bg-yellow-300', chip: 'bg-yellow-100 text-yellow-700', bar: 'border-l-yellow-300' }
}

function fmtEspera(min: number) {
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function desdeHora(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function Pendencias() {
  const [items, setItems] = useState<Pendencia[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizadoEm, setAtualizadoEm] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/pendencias', { cache: 'no-store' }).then((r) => r.json())
      setItems(Array.isArray(d.items) ? d.items : [])
      setAtualizadoEm(new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch {
      /* mantém o que tinha */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000) // atualiza sozinho a cada 15s
    return () => clearInterval(t)
  }, [load])

  const criticos = items.filter((i) => i.waitingMin >= 30).length

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight text-gray-900">
            🔴 Pendências
            {items.length > 0 && <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-base font-bold text-white">{items.length}</span>}
          </h1>
          <p className="text-sm text-gray-500">Leads que <b>o paciente falou por último</b> — responda por ordem de prioridade pra não perder o agendamento.</p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <button onClick={load} className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-500 hover:bg-gray-50">↻ Atualizar</button>
          {atualizadoEm && <div className="mt-1">atualizado {atualizadoEm} · sozinho a cada 15s</div>}
        </div>
      </header>

      {/* resumo */}
      {items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-2xl font-extrabold text-gray-900">{items.length}</div>
            <div className="text-xs text-gray-500">aguardando resposta</div>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 shadow-sm">
            <div className="text-2xl font-extrabold text-red-600">{criticos}</div>
            <div className="text-xs text-red-500/80">esperando +30 min</div>
          </div>
          <div className="col-span-2 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-1">
            <div className="text-2xl font-extrabold text-gray-900">{fmtEspera(items[0]?.waitingMin ?? 0)}</div>
            <div className="text-xs text-gray-500">o que espera há mais tempo</div>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 py-16 text-center">
          <div className="text-4xl">🎉</div>
          <div className="mt-2 text-lg font-bold text-emerald-700">Tudo respondido!</div>
          <div className="text-sm text-emerald-600/80">Nenhum lead esperando. Bom trabalho. 👏</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const t = tier(p.waitingMin)
            return (
              <div key={p.contact_id} className={`flex items-center gap-3 rounded-2xl border border-gray-100 border-l-4 bg-white px-4 py-3 shadow-sm transition hover:shadow-md ${t.bar}`}>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-gray-800">{p.name?.trim() || p.phone || 'Sem nome'}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{t.label}</span>
                  </div>
                  <div className="truncate text-xs text-gray-400">{p.last_text || '—'}</div>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="text-sm font-bold text-gray-700">⏱ {fmtEspera(p.waitingMin)}</div>
                  <div className="text-[11px] text-gray-400">desde {desdeHora(p.last_sent_at)}</div>
                </div>
                <a href={`/inbox?c=${p.contact_id}`} className="shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600">Responder →</a>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
