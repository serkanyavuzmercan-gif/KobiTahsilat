import { cariOrtalamaGecikmeGun, formatGecikmeGun } from './gecikme'
import type { CariBakiye } from './types'
import { formatTL } from './types'
import { formatPhoneDisplay } from './phone'

export type HatirlatmaMessage = {
  body: string
  ozet: string
}

/** WhatsApp metin mesajlarında kalın vurgu için *metin* kullanılır. */
function waBold(text: string) {
  return `*${text}*`
}

export function buildHatirlatmaMessage(cari: CariBakiye, snapshotTarihi: string): HatirlatmaMessage {
  const firma = cari.firma_adi.trim()
  const bakiye = formatTL(cari.bakiye)
  const gecikmis = formatTL(cari.gecikmis_bakiye)
  const vade = cari.odeme_vadesi || 'belirtilen vade'
  const ortalamaGecikme = cariOrtalamaGecikmeGun(cari)
  const ortalamaGecikmeMetni = formatGecikmeGun(ortalamaGecikme)

  const gecikmeNotu =
    cari.gecikmis_bakiye > 0.01
      ? ortalamaGecikme != null
        ? `Bunun ${waBold(gecikmis)} tutarındaki kısmının vadesi geçmiştir. Ortalama gecikme süresi: ${waBold(ortalamaGecikmeMetni)}.`
        : `Bunun ${waBold(gecikmis)} tutarındaki kısmının vadesi geçmiştir.`
      : 'Hesabınızda vadesi geçmiş tutar bulunmamaktadır; bilgilendirme amaçlıdır.'

  const body = `Sayın yetkili,

${waBold(firma)} firmasına ait cari hesabınızda ${waBold(bakiye)} açık bakiye bulunmaktadır. ${gecikmeNotu}

Ödeme planınızı (${waBold(vade)}) göz önünde bulundurarak, mümkün olan en kısa sürede ödemenizi rica ederiz. Bir hata olduğunu düşünüyorsanız veya ödeme yaptıysanız lütfen bize yazın; kayıtlarımızı birlikte kontrol edelim.

Saygılarımızla,
${waBold('Hidroteknik A.Ş.')}
Tahsilat · ${snapshotTarihi}`

  const ozet = `${firma} · ${bakiye} açık bakiye${
    cari.gecikmis_bakiye > 0.01
      ? ` · ${gecikmis} gecikmiş${
          ortalamaGecikme != null ? ` · ort. gecikme ${ortalamaGecikmeMetni}` : ''
        }`
      : ''
  }`

  return { body, ozet }
}

export function formatHatirlatmaPreview(cari: CariBakiye, telefon: string | null) {
  return {
    alici: telefon ? formatPhoneDisplay(telefon) : 'Telefon girilmedi',
    firma: cari.firma_adi,
  }
}
