import { NextResponse } from 'next/server'
import { loadSnapshot, searchCariler } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const snap = loadSnapshot()
  const cariler = q ? searchCariler(q) : snap.cariler
  return NextResponse.json({
    sourced_at: snap.sourced_at,
    source: snap.source,
    cari_sayisi: cariler.length,
    toplam_alacak: Math.round(cariler.reduce((s, c) => s + c.bakiye, 0) * 100) / 100,
    cariler,
  })
}
