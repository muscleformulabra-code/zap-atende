import { NextResponse } from 'next/server'
import { getAnalytics } from '@/lib/db'

export async function GET(req: Request) {
  const u = new URL(req.url)
  const from = u.searchParams.get('from')
  const to = u.searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from e to obrigatórios' }, { status: 400 })
  return NextResponse.json(await getAnalytics(from, to))
}
