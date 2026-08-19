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
/**
 * Yakın zamanda ödeme yapıldıysa mesajın BAŞINA teşekkür satırı gelir.
 * Gerekçe (2026-08 HİDROBARSAN olayı): müşteri 50.000 ₺ ödedi, sistem bunu görmezden gelip
 * standart hatırlatmayı gönderdi. Kırıcı olan tutar değil, MUHATAP ALINMAMA hissiydi.
 * Hatırlatma durmaz — yalnız ödemeyi tanır.
 */
export function odemeTesekkurSatiri(odenen: number): string {
  if (!(odenen > 0)) return ''
  return `${formatTL(odenen)} tutarındaki ödemeniz alınmıştır, teşekkür ederiz.`
}

export function buildOdemeTalepMesaj(
  cari: CariBakiye,
  _snapshotTarihi: string,
  pdfUrl: string,
  /** Son günlerde tespit edilen ödeme (varsa mesaj teşekkürle başlar). */
  sonOdeme = 0
): OdemeTalepMesaj {
  const firma = cari.firma_adi.trim()
  const dokum = buildOdemeTalepDokum(cari.acik_kalemler, cari.bakiye)
  const vadesiGecen = formatTL(dokum.vadesi_gecen_toplam)
  const genel = formatTL(dokum.genel_bakiye)
  const faturaAdet = dokum.faturalar.length + (dokum.diger_adet > 0 ? 1 : 0)
  const tesekkur = odemeTesekkurSatiri(sonOdeme)

  const body = `Sayın ${waBold(firma)} yetkilisi,
${tesekkur ? `\n${tesekkur}\n` : ''}
Cari hesabınızda ${tesekkur ? 'kalan' : ''} vadesi geçen ${waBold(vadesiGecen)} tutarında alacağımız bulunmaktadır.

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
