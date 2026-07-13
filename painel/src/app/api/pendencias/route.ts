import { NextResponse } from 'next/server'
import { getPendencias } from '@/lib/db'

// Leads aguardando resposta agora (pendências). ?count=1 → só o total (leve,
// pro badge da sidebar).
export async function GET(req: Request) {
  const onlyCount = new URL(req.url).searchParams.get('count') === '1'
  try {
    const items = await getPendencias()
    if (onlyCount) return NextResponse.json({ count: items.length })
    return NextResponse.json({ items, count: items.length })
  } catch {
    return NextResponse.json({ items: [], count: 0 })
  }
}
