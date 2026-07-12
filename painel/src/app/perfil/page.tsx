'use client'

import { useEffect, useRef, useState } from 'react'

export default function Perfil() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setEmail(d.email || '')
        setName(d.name || '')
        setPhone(d.phone || '')
        setAvatar(d.avatar_url || null)
      })
      .finally(() => setLoaded(true))
  }, [])

  async function enviarFoto(file: File) {
    setUploading(true)
    setMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'falha no upload')
      setAvatar(d.url)
    } catch (e) {
      setMsg('❌ ' + (e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      const r = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, avatar_url: avatar }),
      })
      if (!r.ok) throw new Error((await r.json()).error || 'erro')
      setMsg('✅ perfil salvo')
    } catch (e) {
      setMsg('❌ ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || email || '?').slice(0, 2).toUpperCase()

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu perfil</h1>
        <p className="text-sm text-gray-500">Seu nome aparece nas mensagens que você envia aos pacientes</p>
      </header>

      <form onSubmit={salvar} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* Foto */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-200"
            title="Trocar foto"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="foto" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">{initials}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/40 py-1 text-center text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? '...' : 'trocar'}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f) }}
          />
          <span className="mt-2 text-xs text-gray-400">JPG ou PNG, até 5 MB</span>
        </div>

        {/* Campos */}
        <label className="mt-6 block">
          <span className="text-sm font-medium text-gray-600">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você aparece nas mensagens" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-600">Telefone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 61 90000-0000" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-600">E-mail</span>
          <input value={email} disabled className="mt-1 w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-400" />
        </label>

        <div className="mt-6 flex items-center gap-3">
          <button disabled={saving || !loaded} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60">
            {saving ? 'salvando…' : 'Salvar alterações'}
          </button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      </form>

      <TwoFactor />
    </main>
  )
}

// ── Segurança: verificação em duas etapas (2FA / TOTP) ──
function TwoFactor() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [factorId, setFactorId] = useState('')
  const [enroll, setEnroll] = useState<{ qr: string; secret: string; id: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const d = await (await fetch('/api/mfa')).json().catch(() => ({}))
    setEnabled(!!d.enabled)
    setFactorId(d.factorId || '')
  }
  useEffect(() => { load() }, [])

  async function ativar() {
    setBusy(true); setMsg('')
    try {
      const d = await (await fetch('/api/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enroll' }) })).json()
      if (d.error) throw new Error(d.error)
      setEnroll({ qr: d.qr_code, secret: d.secret, id: d.id })
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  async function confirmar() {
    if (!enroll) return
    setBusy(true); setMsg('')
    try {
      const d = await (await fetch('/api/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', factorId: enroll.id, code }) })).json()
      if (d.error) throw new Error(d.error)
      setEnroll(null); setCode(''); setMsg('✅ 2FA ativado!')
      load()
    } catch (e) { setMsg('❌ ' + (e as Error).message) } finally { setBusy(false) }
  }

  async function desativar() {
    if (!confirm('Desativar a verificação em duas etapas?')) return
    setBusy(true); setMsg('')
    await fetch('/api/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable', factorId }) })
    setMsg(''); load()
  }

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">🔐 Verificação em 2 etapas (2FA)</h2>
          <p className="text-sm text-gray-500">Uma camada extra: pede um código do app autenticador ao entrar.</p>
        </div>
        {enabled === true && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Ativado ✓</span>}
      </div>

      {enabled === true && !enroll && (
        <button onClick={desativar} disabled={busy} className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">Desativar 2FA</button>
      )}

      {enabled === false && !enroll && (
        <button onClick={ativar} disabled={busy} className="mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60">
          {busy ? 'gerando…' : 'Ativar 2FA'}
        </button>
      )}

      {enroll && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm text-gray-600">1. Escaneie o QR no <b>Google Authenticator</b> (ou similar):</p>
          <div className="mx-auto mb-3 flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2 shadow-inner">
            {enroll.qr.startsWith('<svg')
              ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: enroll.qr }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={enroll.qr} alt="QR 2FA" className="h-full w-full object-contain" />}
          </div>
          <p className="mb-3 break-all text-center text-[11px] text-gray-400">ou digite: <span className="font-mono">{enroll.secret}</span></p>
          <p className="mb-2 text-sm text-gray-600">2. Digite o código de 6 dígitos que aparece no app:</p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000" className="w-32 rounded-lg border border-gray-300 p-2 text-center text-lg font-bold tracking-widest outline-none focus:border-emerald-500" />
            <button onClick={confirmar} disabled={busy || code.length !== 6} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">Confirmar</button>
            <button onClick={() => { setEnroll(null); setCode('') }} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:underline">cancelar</button>
          </div>
        </div>
      )}

      {msg && <div className="mt-3 text-sm text-gray-600">{msg}</div>}
    </section>
  )
}
