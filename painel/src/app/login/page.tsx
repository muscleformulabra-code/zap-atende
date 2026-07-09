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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Zap Atende</h1>
        <p className="mb-6 text-sm text-gray-500">Entre com seu acesso de atendente</p>

        <label className="block text-sm font-medium text-gray-600">E-mail</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mb-4 mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />

        <label className="block text-sm font-medium text-gray-600">Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mb-4 mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-emerald-500" />

        {err && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
          {loading ? 'entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
