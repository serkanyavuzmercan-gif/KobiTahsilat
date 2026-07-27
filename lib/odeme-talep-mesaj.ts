import type { CariBakiye } from './types'
import { formatTL } from './types'
import { buildOdemeTalepDokum } from './odeme-talep-dokum'

export type OdemeTalepMesaj = {
  body: string
  ozet: string
}

function waBold(text: string) {
  return `*${text}*`
}

/**
 * Fatura bazlı ödeme talebi metni. Detaylı fatura dökümü PDF'e taşındığı için
 * mesaj gövdesi kısa tutulur: toplamlar + PDF linki. WhatsApp'ta link tıklanınca
 * müşteri kendi faturalarını (belge no, tarih, gecikme, tutar) PDF'te görür.
 */
export function buildOdemeTalepMesaj(
  cari: CariBakiye,
  _snapshotTarihi: string,
  pdfUrl: string
): OdemeTalepMesaj {
  const firma = cari.firma_adi.trim()
  const dokum = buildOdemeTalepDokum(cari.acik_kalemler, cari.bakiye)
  const vadesiGecen = formatTL(dokum.vadesi_gecen_toplam)
  const genel = formatTL(dokum.genel_bakiye)
  const faturaAdet = dokum.faturalar.length + (dokum.diger_adet > 0 ? 1 : 0)

  const body = `Sayın ${waBold(firma)} yetkilisi,

Cari hesabınızda vadesi geçen ${waBold(vadesiGecen)} tutarında alacağımız bulunmaktadır.

Vadesi geçen faturalarınızın detaylı dökümünü (PDF) incelemek için:
${pdfUrl}

Genel bakiye: ${waBold(genel)}
Vadesi dolan: ${waBold(vadesiGecen)}

Ödemenizi en kısa sürede yapmanızı rica eder, bir hata olduğunu düşünüyorsanız veya ödeme yaptıysanız bize yazmanızı rica ederiz.

Saygılarımızla,
${waBold('Hidroteknik A.Ş.')}`

  const ozet = `${firma} · ${vadesiGecen} vadesi geçmiş${
    faturaAdet ? ` · ${faturaAdet} kalem` : ''
  }`

  return { body, ozet }
}
