import { HatirlatmaClient } from '@/components/hatirlatma-client'
import { loadIletisimEtiketleri } from '@/lib/cari-kisiler'
import { loadSnapshot } from '@/lib/data'
import { loadHatirlatmaCariler } from '@/lib/hatirlatma-data'
import { createOdemeTalepToken } from '@/lib/odeme-talep-token'
import { getOrCreateDokumShortLink } from '@/lib/dokum-link'
import { whatsAppBotEnabled } from '@/lib/whatsapp-kuyruk'

export const dynamic = 'force-dynamic'

export default async function HatirlatmaPage() {
  const snapshot = await loadSnapshot()
  const cariler = await loadHatirlatmaCariler()

  // Her cari için döküm linki (modal önizleme). TEK KAYNAK: getOrCreateDokumShortLink → kısa /d/<code>
  // (gönderim de aynısını kullanır). Kısa link üretilemezse imzalı uzun PDF URL'sine düşer.
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(
    /\/$/,
    ''
  )
  const pdfUrls: Record<string, string> = {}
  const linkler = await Promise.all(
    cariler.map(async (cari) => {
      const kisa = await getOrCreateDokumShortLink(cari.cari_kod, snapshot.snapshot_tarihi)
      if (kisa) return [cari.cari_kod, kisa] as const
      const token = createOdemeTalepToken(cari.cari_kod, snapshot.snapshot_tarihi)
      return [cari.cari_kod, `${baseUrl}/api/odeme-talebi/pdf?token=${encodeURIComponent(token)}`] as const
    })
  )
  for (const [kod, url] of linkler) pdfUrls[kod] = url

  // Numara/e-posta yanına yazılacak açıklamalar (ad + rol; cari_kisiler'den).
  const etiketler = await loadIletisimEtiketleri(cariler.map((c) => c.cari_kod))

  return (
    <HatirlatmaClient
      cariler={cariler}
      snapshotTarihi={snapshot.snapshot_tarihi}
      sendEnabled={whatsAppBotEnabled()}
      pdfUrls={pdfUrls}
      etiketler={etiketler}
    />
  )
}
