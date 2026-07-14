import { loadSnapshot } from '@/lib/data'
import CarilerClient from '@/components/cariler-client'

export const dynamic = 'force-dynamic'

export default function CarilerPage() {
  const snap = loadSnapshot()
  return (
    <CarilerClient
      cariler={snap.cariler}
      toplam={snap.toplam_alacak}
      sourcedAt={snap.sourced_at}
    />
  )
}
