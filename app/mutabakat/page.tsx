import { MutabakatClient } from '@/components/mutabakat-client'
import { loadSnapshot } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default function MutabakatPage() {
  const snapshot = loadSnapshot()
  return <MutabakatClient cariler={snapshot.cariler} snapshotTarihi={snapshot.snapshot_tarihi} />
}
