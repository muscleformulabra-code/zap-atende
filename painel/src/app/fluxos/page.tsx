'use client'

import { useEffect, useState } from 'react'

type FlowItem = { id: string; name: string; is_active: boolean; updated_at: string }

export default function Fluxos() {
  const [flows, setFlows] = useState<FlowItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/flows')
    setFlows(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function criar() {
    const name = prompt('Nome do novo fluxo:')?.trim()
    if (!name) return
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    if (data.id) window.location.href = `/construtor?id=${data.id}`
  }

  async function ativar(id: string) {
    await fetch(`/api/flows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate' }),
    })
    load()
  }

  async function renomear(id: string, atual: string) {
    const name = prompt('Novo nome:', atual)?.trim()
    if (!name) return
    await fetch(`/api/flows/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', name }),
    })
    load()
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o fluxo "${nome}"? Isso não pode ser desfeito.`)) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluxos de conversa</h1>
          <p className="text-sm text-gray-500">Seus chatbots. O fluxo <b>ativo</b> atende os contatos novos.</p>
        </div>
        <button onClick={criar} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          + Novo fluxo
        </button>
      </header>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">carregando…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {flows.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-800">{f.name}</span>
                  {f.is_active && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">ativo</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  atualizado {new Date(f.updated_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <a href={`/construtor?id=${f.id}`} className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">
                editar
              </a>
              {!f.is_active && (
                <button onClick={() => ativar(f.id)} className="text-sm font-medium text-emerald-600 hover:underline">
                  ativar
                </button>
              )}
              <button onClick={() => renomear(f.id, f.name)} className="text-sm text-gray-500 hover:underline">
                renomear
              </button>
              <button onClick={() => excluir(f.id, f.name)} className="text-sm text-red-500 hover:underline">
                excluir
              </button>
            </div>
          ))}
          {flows.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-gray-400">Nenhum fluxo ainda.</div>
          )}
        </div>
      )}
    </main>
  )
}
