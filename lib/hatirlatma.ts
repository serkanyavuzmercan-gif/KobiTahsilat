import { cariOrtalamaGecikmeGun, formatGecikmeGun } from './gecikme'
import type { CariBakiye } from './types'
import { formatTL } from './types'
import { formatPhoneDisplay } from './phone'
import { odemeTesekkurSatiri } from './odeme-talep-mesaj'

export type HatirlatmaMessage = {
  body: string
  ozet: string
}

/** WhatsApp metin mesajlarında kalın vurgu için *metin* kullanılır. */
function waBold(text: string) {
  return `*${text}*`
}

export function buildHatirlatmaMessage(
  cari: CariBakiye,
  snapshotTarihi: string,
  /** Son günlerde tespit edilen ödeme — varsa mesaj teşekkürle başlar (ödemeyi görmezden gelmeyelim). */
  sonOdeme = 0
): HatirlatmaMessage {
  const firma = cari.firma_adi.trim()
  const bakiye = formatTL(cari.bakiye)
  const gecikmis = formatTL(cari.gecikmis_bakiye)
  const vade = cari.odeme_vadesi || 'belirtilen vade'
  const ortalamaGecikme = cariOrtalamaGecikmeGun(cari)
  const ortalamaGecikmeMetni = formatGecikmeGun(ortalamaGecikme)

  const tesekkur = odemeTesekkurSatiri(sonOdeme)

  const gecikmeNotu =
    cari.gecikmis_bakiye > 0.01
      ? ortalamaGecikme != null
        ? `Bunun ${waBold(gecikmis)} tutarındaki ${tesekkur ? 'kalan ' : ''}kısmının vadesi geçmiştir. Ortalama gecikme süresi: ${waBold(ortalamaGecikmeMetni)}.`
        : `Bunun ${waBold(gecikmis)} tutarındaki ${tesekkur ? 'kalan ' : ''}kısmının vadesi geçmiştir.`
      : 'Hesabınızda vadesi geçmiş tutar bulunmamaktadır; bilgilendirme amaçlıdır.'

  const body = `Sayın yetkili,
${tesekkur ? `\n${tesekkur}\n` : ''}
${waBold(firma)} firmasına ait cari hesabınızda ${tesekkur ? 'güncel olarak ' : ''}${waBold(bakiye)} açık bakiye bulunmaktadır. ${gecikmeNotu}

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
