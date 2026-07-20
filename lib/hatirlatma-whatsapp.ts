import 'server-only'
import type { CariBakiye } from './types'
import { formatTL } from './types'
import { buildOdemeTalepDokum } from './odeme-talep-dokum'
import { createOdemeTalepToken } from './odeme-talep-token'
import { getOrCreateDokumShortLink } from './dokum-link'
import { sendWhatsAppTemplate, whatsAppCloudYapili } from './whatsapp-cloud'
import { whatsAppBotEnabled } from './whatsapp-kuyruk'

/**
 * Tahsilat WhatsApp ödeme talebi — resmi WhatsApp Cloud API üzerinden onaylı şablonla gider
 * (eski Baileys kuyruğunun yerini aldı). Proaktif gönderim 24 saat penceresi dışında olduğu
 * için serbest metin gönderilemez; Meta onaylı "odeme_talebi_hatirlatma" şablonu kullanılır.
 * Şablon değişkenleri: {{1}} firma, {{2}} vadesi geçen tutar, {{3}} fatura dökümü PDF linki.
 */

export const ODEME_TALEP_TEMPLATE =
  process.env.WHATSAPP_ODEME_TALEP_TEMPLATE || 'odeme_talebi_hatirlatma'
export const ODEME_TALEP_TEMPLATE_LANG = process.env.WHATSAPP_ODEME_TALEP_LANG || 'tr'

export type HatirlatmaWhatsAppSendResult = {
  mode: 'cloud'
  wamid: string
}

/** Müşteriye açık, imzalı PDF döküm linki (finans.hidroteknik.com.tr). */
export function odemeTalepPdfUrl(cariKod: string, snapshotTarihi: string): string {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr'
  ).replace(/\/$/, '')
  const token = createOdemeTalepToken(cariKod, snapshotTarihi)
  return `${baseUrl}/api/odeme-talebi/pdf?token=${encodeURIComponent(token)}`
}

/**
 * Göndermeden, WhatsApp müşteriye görünecek mesajın birebir metnini üretir (önizleme).
 * Meta onaylı "odeme_talebi_hatirlatma" gövdesi + {{1}}/{{2}}/{{3}} doldurulur.
 */
export async function buildHatirlatmaWhatsAppOnizleme(
  cari: CariBakiye,
  snapshotTarihi: string
): Promise<{ text: string; tutar: string; pdfUrl: string }> {
  const dokum = buildOdemeTalepDokum(cari.acik_kalemler, cari.bakiye)
  const tutar = formatTL(dokum.vadesi_gecen_toplam)
  // Kısa döküm linki (WhatsApp'ta uzun token URL'si yerine); üretilemezse uzununa düş.
  const pdfUrl =
    (await getOrCreateDokumShortLink(cari.cari_kod, snapshotTarihi)) ||
    odemeTalepPdfUrl(cari.cari_kod, snapshotTarihi)
  const text = `Sayın ${cari.firma_adi.trim()} yetkilisi,

Cari hesabınızda vadesi geçen ${tutar} tutarında alacağımız bulunmaktadır. Vadesi geçen faturalarınızın detaylı dökümüne aşağıdaki bağlantıdan ulaşabilirsiniz:

${pdfUrl}

Ödemenizi en kısa sürede yapmanızı; ödeme yaptıysanız veya bir hata olduğunu düşünüyorsanız bizimle iletişime geçmenizi rica ederiz.

Saygılarımızla,
Hidroteknik A.Ş.`
  return { text, tutar, pdfUrl }
}

export async function sendHatirlatmaWhatsApp(options: {
  to: string
  cari: CariBakiye
  snapshotTarihi: string
}): Promise<HatirlatmaWhatsAppSendResult> {
  const dokum = buildOdemeTalepDokum(options.cari.acik_kalemler, options.cari.bakiye)
  const tutar = formatTL(dokum.vadesi_gecen_toplam)
  const pdfUrl =
    (await getOrCreateDokumShortLink(options.cari.cari_kod, options.snapshotTarihi)) ||
    odemeTalepPdfUrl(options.cari.cari_kod, options.snapshotTarihi)

  const result = await sendWhatsAppTemplate({
    to: options.to,
    template: ODEME_TALEP_TEMPLATE,
    lang: ODEME_TALEP_TEMPLATE_LANG,
    bodyParams: [options.cari.firma_adi.trim(), tutar, pdfUrl],
  })
  if (!result.ok) throw new Error(result.error)
  return { mode: 'cloud', wamid: result.wamid }
}

export type HatirlatmaWhatsAppContext = {
  botEnabled: boolean
  botCevrimici: boolean
  sonPoll: string | null
  sonGonderim: string | null
}

export async function loadHatirlatmaWhatsAppContext(
  _phone: string | null,
  _cariKod: string
): Promise<HatirlatmaWhatsAppContext> {
  // Resmi Cloud API: "ofis botu çevrimiçi mi" kavramı yok; token+numara yapılandırılmışsa hazırdır.
  return {
    botEnabled: whatsAppBotEnabled(),
    botCevrimici: whatsAppCloudYapili(),
    sonPoll: null,
    sonGonderim: null,
  }
}

export function hatirlatmaDeliveryHint(): string {
  return 'Mesaj resmi WhatsApp Cloud API üzerinden onaylı şablonla gönderildi.'
}
