import { Suspense } from 'react'
import { loadSnapshot } from '@/lib/data'
import { requireAuthUser } from '@/lib/auth'
import { loadCariYanitlari, loadYanitInbox } from '@/lib/cari-yanitlar'
import { CarilerPageClient } from '@/components/cariler-page-client'

export const dynamic = 'force-dynamic'

export default async function CarilerPage() {
  const user = await requireAuthUser()
  const snap = loadSnapshot()
  const kodlar = snap.cariler.map((cari) => cari.cari_kod)
  const [yanitlar, inbox] = await Promise.all([
    loadCariYanitlari(user.id, kodlar),
    loadYanitInbox(user.id),
  ])

  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Yükleniyor…</div>}>
      <CarilerPageClient
        cariler={snap.cariler}
        toplam={snap.toplam_alacak}
        sourcedAt={snap.sourced_at}
        yanitlar={yanitlar}
        inbox={inbox}
      />
    </Suspense>
  )
}
