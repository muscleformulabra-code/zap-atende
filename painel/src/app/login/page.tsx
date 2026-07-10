'use client'

import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falha no login')
      window.location.href = '/'
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      {/* brilhos de fundo */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />

      <form onSubmit={entrar} className="za-pop relative w-full max-w-sm rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl shadow-emerald-100 backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl text-white shadow-lg shadow-emerald-200">💬</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Zap Atende</h1>
          <p className="text-sm text-gray-500">Entre com seu acesso de atendente</p>
        </div>

        <label className="block text-sm font-medium text-gray-600">E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mb-4 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        <label className="block text-sm font-medium text-gray-600">Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mb-4 mt-1 w-full rounded-xl border border-gray-300 bg-white p-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />

        {err && <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60">
          {loading ? 'entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
