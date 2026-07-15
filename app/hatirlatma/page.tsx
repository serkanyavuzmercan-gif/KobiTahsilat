import { HatirlatmaClient } from '@/components/hatirlatma-client'
import { loadSnapshot } from '@/lib/data'
import { loadHatirlatmaCariler } from '@/lib/hatirlatma-data'
import { createOdemeTalepToken } from '@/lib/odeme-talep-token'
import { whatsAppBotEnabled } from '@/lib/whatsapp-kuyruk'

export const dynamic = 'force-dynamic'

export default async function HatirlatmaPage() {
  const snapshot = await loadSnapshot()
  const cariler = await loadHatirlatmaCariler()

  // Her cari için imzalı PDF linki (WhatsApp metni + modal önizleme).
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobi-tahsilat.vercel.app').replace(
    /\/$/,
    ''
  )
  const pdfUrls: Record<string, string> = {}
  for (const cari of cariler) {
    const token = createOdemeTalepToken(cari.cari_kod, snapshot.snapshot_tarihi)
    pdfUrls[cari.cari_kod] = `${baseUrl}/api/odeme-talebi/pdf?token=${encodeURIComponent(token)}`
  }

  return (
    <HatirlatmaClient
      cariler={cariler}
      snapshotTarihi={snapshot.snapshot_tarihi}
      sendEnabled={whatsAppBotEnabled()}
      pdfUrls={pdfUrls}
    />
  )
}
