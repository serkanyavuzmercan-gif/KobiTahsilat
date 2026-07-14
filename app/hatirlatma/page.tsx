import { HatirlatmaClient } from '@/components/hatirlatma-client'
import { loadSnapshot } from '@/lib/data'
import { loadHatirlatmaCariler } from '@/lib/hatirlatma-data'
import { whatsAppSendEnabled } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function HatirlatmaPage() {
  const snapshot = loadSnapshot()
  const cariler = await loadHatirlatmaCariler()
  return (
    <HatirlatmaClient
      cariler={cariler}
      snapshotTarihi={snapshot.snapshot_tarihi}
      sendEnabled={whatsAppSendEnabled()}
    />
  )
}
