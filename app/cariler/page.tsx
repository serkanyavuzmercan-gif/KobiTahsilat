import { loadSnapshot } from '@/lib/data'
import { loadCariYanitlari } from '@/lib/cari-yanitlar'
import CarilerClient from '@/components/cariler-client'

export const dynamic = 'force-dynamic'

export default async function CarilerPage() {
  const snap = loadSnapshot()
  const kodlar = snap.cariler.map((cari) => cari.cari_kod)
  const yanitlar = await loadCariYanitlari(kodlar)

  return (
    <CarilerClient
      cariler={snap.cariler}
      toplam={snap.toplam_alacak}
      sourcedAt={snap.sourced_at}
      yanitlar={yanitlar}
    />
  )
}
