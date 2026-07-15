import { MutabakatClient } from '@/components/mutabakat-client'
import { loadSnapshot } from '@/lib/data'
import { loadMutabakatCariler } from '@/lib/mutabakat-data'

export const dynamic = 'force-dynamic'

export default async function MutabakatPage() {
  const snapshot = await loadSnapshot()
  const cariler = await loadMutabakatCariler()
  const sendEnabled = process.env.MUTABAKAT_SEND_ENABLED !== 'false'
  return (
    <MutabakatClient
      cariler={cariler}
      snapshotTarihi={snapshot.snapshot_tarihi}
      sendEnabled={sendEnabled}
    />
  )
}
