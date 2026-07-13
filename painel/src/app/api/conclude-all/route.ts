import { NextResponse } from 'next/server'
import { concludeAllOpen } from '@/lib/db'

// Conclui todas as conversas abertas da empresa ativa. Reversível (reabrir).
export async function POST() {
  try {
    const n = await concludeAllOpen()
    return NextResponse.json({ ok: true, concluded: n })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
