import { Suspense } from 'react'
import { loadSnapshot } from '@/lib/data'
import { requireAuthUser } from '@/lib/auth'
import CarilerClient from '@/components/cariler-client'

export const dynamic = 'force-dynamic'

export default async function CarilerPage() {
  await requireAuthUser()
  const snap = await loadSnapshot()

  // Yanıtlar artık "Mutabakat > Sonuçlar" altında görülüyor; burada yanıt verisi çekilmez
  // (sayfa açılış hızını yavaşlatıyordu). Yalnız cari listesi + sayfalama.
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Yükleniyor…</div>}>
      <CarilerClient
        cariler={snap.cariler}
        toplam={snap.toplam_alacak}
        sourcedAt={snap.sourced_at}
      />
    </Suspense>
  )
}
