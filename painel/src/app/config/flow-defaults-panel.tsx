'use client'

import { useEffect, useState } from 'react'

type Flow = { id: string; name: string; is_active: boolean }

export default function FlowDefaultsPanel() {
  const [flows, setFlows] = useState<Flow[]>([])
  const [welcome, setWelcome] = useState<string | null>(null)
  const [def, setDef] = useState<string | null>(null)
  const [media, setMedia] = useState<string | null>(null)
  const [saved, setSaved] = useState('')

  async function load() {
    const d = await (await fetch('/api/flow-defaults')).json()
    setFlows(d.flows || [])
    setWelcome(d.welcomeFlowId)
    setDef(d.defaultFlowId)
    setMedia(d.mediaFlowId)
  }
  useEffect(() => { load() }, [])

  async function salvar(patch: { welcomeFlowId?: string; defaultFlowId?: string | null; mediaFlowId?: string | null }) {
    await fetch('/api/flow-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    setSaved('✓ salvo'); setTimeout(() => setSaved(''), 1500)
    load()
  }

  const Selector = ({ value, onChange, allowNone }: { value: string | null; onChange: (v: string) => void; allowNone?: boolean }) => (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:border-emerald-500">
      {allowNone && <option value="">— nenhum —</option>}
      {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
    </select>
  )

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-800">Fluxo de boas-vindas</div>
        <p className="mt-1 text-xs text-gray-500">Enviado só a contatos novos (quem nunca falou com o robô), 1x.</p>
        <Selector value={welcome} onChange={(v) => salvar({ welcomeFlowId: v })} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-800">Fluxo de resposta padrão</div>
        <p className="mt-1 text-xs text-gray-500">Enviado quando um contato que já foi atendido volta a escrever (o &quot;2º contato&quot;).</p>
        <Selector value={def} onChange={(v) => salvar({ defaultFlowId: v })} allowNone />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="font-medium text-gray-800">Fluxo padrão para mídia</div>
        <p className="mt-1 text-xs text-gray-500">Enviado quando o paciente manda um anexo (imagem, vídeo, áudio, arquivo).</p>
        <Selector value={media} onChange={(v) => salvar({ mediaFlowId: v })} allowNone />
      </section>

      {saved && <div className="text-sm text-emerald-600">{saved}</div>}
    </div>
  )
}
