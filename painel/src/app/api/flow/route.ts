import { NextResponse } from 'next/server'

// Rota antiga (single-flow) — substituída por /api/flows e /api/flows/[id].
export async function GET() {
  return NextResponse.json({ deprecated: true, use: '/api/flows' }, { status: 410 })
}
