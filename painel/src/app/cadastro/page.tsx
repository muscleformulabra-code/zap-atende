'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

// Regras de senha (estilo BotConversa) com check verde ao vivo.
function rules(pw: string, confirm: string) {
  return [
    { ok: pw.length >= 8, label: 'Pelo menos 8 caracteres' },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: 'Letras maiúsculas e minúsculas' },
    { ok: /\d/.test(pw), label: 'Pelo menos 1 número' },
    { ok: /[!@#$%^&*(),.?":{}|<>_\-]/.test(pw), label: 'Pelo menos 1 símbolo (!@#$…)' },
    { ok: pw.length > 0 && pw === confirm, label: 'As senhas conferem' },
  ]
}

export default function Cadastro() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const checks = useMemo(() => rules(password, confirm), [password, confirm])
  const allOk = checks.every((c) => c.ok) && !!email.trim()

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    if (!allOk) return
    setErr('')
    setLoading(true)
    try {
      const r = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falha no cadastro')
      window.location.href = d.hasCompany ? '/' : '/aguardando'
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />

      <form onSubmit={cadastrar} className="za-pop relative w-full max-w-sm rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl shadow-emerald-100 backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl text-white shadow-lg shadow-emerald-200">💬</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Criar sua conta</h1>
          <p className="text-sm text-gray-500">É rápido. Depois é só o admin te convidar.</p>
        </div>

        <label className="block text-sm font-medium text-gray-600">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado(a)" className="mb-4 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        <label className="block text-sm font-medium text-gray-600">E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mb-4 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        <label className="block text-sm font-medium text-gray-600">Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mb-3 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        <label className="block text-sm font-medium text-gray-600">Confirme a senha</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mb-4 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        <ul className="mb-5 space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 text-sm transition ${c.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${c.ok ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>{c.ok ? '✓' : '·'}</span>
              {c.label}
            </li>
          ))}
        </ul>

        {err && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

        <button type="submit" disabled={loading || !allOk} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? 'criando…' : 'Criar conta'}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{' '}
          <Link href="/login" className="font-semibold text-emerald-600 hover:underline">Entrar</Link>
        </p>
      </form>
    </main>
  )
}
