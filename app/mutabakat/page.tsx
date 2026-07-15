import { MutabakatPageClient } from '@/components/mutabakat-page-client'
import { loadSnapshot } from '@/lib/data'
import { loadMutabakatCariler } from '@/lib/mutabakat-data'
import { loadMutabakatSonuclar } from '@/lib/cari-yanitlar'

export const dynamic = 'force-dynamic'

export default async function MutabakatPage() {
  const snapshot = await loadSnapshot()
  const [cariler, sonuclar] = await Promise.all([
    loadMutabakatCariler(),
    loadMutabakatSonuclar(),
  ])
  const sendEnabled = process.env.MUTABAKAT_SEND_ENABLED !== 'false'
  return (
    <MutabakatPageClient
      cariler={cariler}
      snapshotTarihi={snapshot.snapshot_tarihi}
      sendEnabled={sendEnabled}
      sonuclar={sonuclar}
    />
  )
}
