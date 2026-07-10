import { NextResponse } from 'next/server'
import { listTags } from '@/lib/db'

// Lista as etiquetas em uso, com a contagem de contatos de cada uma.
export async function GET() {
  return NextResponse.json(await listTags())
}
