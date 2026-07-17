import { NextResponse } from 'next/server'
import { searchMessages } from '@/lib/db'

// Busca por conteúdo de mensagem (estilo WhatsApp), na empresa ativa.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') || ''
  return NextResponse.json(await searchMessages(q))
}
