import type { CariBakiye } from './types'
import { formatTL } from './types'
import { formatPhoneDisplay } from './phone'

export type HatirlatmaMessage = {
  body: string
  ozet: string
}

export function buildHatirlatmaMessage(cari: CariBakiye, snapshotTarihi: string): HatirlatmaMessage {
  const firma = cari.firma_adi.trim()
  const bakiye = formatTL(cari.bakiye)
  const gecikmis = formatTL(cari.gecikmis_bakiye)
  const vade = cari.odeme_vadesi || 'belirtilen vade'

  const gecikmeNotu =
    cari.gecikmis_bakiye > 0.01
      ? `Bunun ${gecikmis} tutarındaki kısmının vadesi geçmiştir.`
      : 'Hesabınızda vadesi geçmiş tutar bulunmamaktadır; bilgilendirme amaçlıdır.'

  const body = `Sayın yetkili,

${firma} firmasına ait cari hesabınızda ${bakiye} açık bakiye bulunmaktadır. ${gecikmeNotu}

Ödeme planınızı (${vade}) göz önünde bulundurarak, mümkün olan en kısa sürede ödemenizi rica ederiz. Bir hata olduğunu düşünüyorsanız veya ödeme yaptıysanız lütfen bize yazın; kayıtlarımızı birlikte kontrol edelim.

Saygılarımızla,
Hidroteknik A.Ş.
Tahsilat · ${snapshotTarihi}`

  const ozet = `${firma} · ${bakiye} açık bakiye${cari.gecikmis_bakiye > 0.01 ? ` · ${gecikmis} gecikmiş` : ''}`

  return { body, ozet }
}

export function formatHatirlatmaPreview(cari: CariBakiye, telefon: string | null) {
  return {
    alici: telefon ? formatPhoneDisplay(telefon) : 'Telefon girilmedi',
    firma: cari.firma_adi,
  }
}
