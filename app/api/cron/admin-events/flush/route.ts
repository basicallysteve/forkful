import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request) {
  return NextResponse.json({ ok: true })
}
