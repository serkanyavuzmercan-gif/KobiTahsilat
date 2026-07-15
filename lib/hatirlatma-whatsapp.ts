import 'server-only'
import { cariOrtalamaGecikmeGun, formatGecikmeGun } from './gecikme'
import { CARI_WHATSAPP_YANIT_TIP } from './cari-yanit-log'
import type { CariBakiye } from './types'
import { formatTL } from './types'
import { formatPhoneWhatsApp } from './phone'
import { createAdminClient } from './supabase/admin'
import { loadSsWhatsAppSession } from './whatsapp-ss'
import {
  sendWhatsApp,
  sendWhatsAppTemplate,
  type WhatsAppSendResult,
  type WhatsAppTemplateComponent,
} from './whatsapp'

const WINDOW_MS = 24 * 60 * 60 * 1000

export type HatirlatmaWhatsAppSendMode = 'text' | 'template'

export type HatirlatmaWhatsAppSendResult = WhatsAppSendResult & {
  mode: HatirlatmaWhatsAppSendMode
  templateName?: string
  templateLanguage?: string
}

function hatirlatmaTemplateName() {
  return (
    process.env.WHATSAPP_HATIRLATMA_TEMPLATE ||
    process.env.WHATSAPP_HATIRLATMA_TEMPLATE_NAME ||
    ''
  ).trim()
}

function hatirlatmaTemplateLanguage() {
  return (process.env.WHATSAPP_HATIRLATMA_TEMPLATE_LANG || 'tr').trim() || 'tr'
}

function templateText(value: string, max = 1024) {
  return value.replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Meta şablonu gövde değişkenleri: firma, bakiye, gecikme notu, vade */
export function buildHatirlatmaTemplateParams(cari: CariBakiye) {
  const firma = templateText(cari.firma_adi.trim(), 120)
  const bakiye = templateText(formatTL(cari.bakiye), 40)
  const gecikmis = templateText(formatTL(cari.gecikmis_bakiye), 40)
  const vade = templateText(cari.odeme_vadesi || 'belirtilen vade', 80)
  const ortalamaGecikme = cariOrtalamaGecikmeGun(cari)

  const gecikmeNotu =
    cari.gecikmis_bakiye > 0.01
      ? ortalamaGecikme != null
        ? `${gecikmis} tutarındaki kısmının vadesi geçmiştir. Ortalama gecikme: ${formatGecikmeGun(ortalamaGecikme)}.`
        : `${gecikmis} tutarındaki kısmının vadesi geçmiştir.`
      : 'Hesabınızda vadesi geçmiş tutar bulunmamaktadır; bilgilendirme amaçlıdır.'

  return [firma, bakiye, templateText(gecikmeNotu, 240), vade]
}

export function hatirlatmaTemplateConfigured() {
  return Boolean(hatirlatmaTemplateName())
}

/** Müşteri son 24 saatte WhatsApp'tan yazdıysa serbest metin gönderilebilir. */
export async function hasWhatsAppConversationWindow(
  cariKod: string,
  phone?: string | null,
  now = new Date()
): Promise<boolean> {
  const admin = createAdminClient()
  const since = new Date(now.getTime() - WINDOW_MS).toISOString()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('sent_at')
    .eq('ilgili_id', cariKod)
    .eq('ilgili_tip', CARI_WHATSAPP_YANIT_TIP)
    .gte('sent_at', since)
    .limit(1)

  if (error) throw error
  if ((data?.length ?? 0) > 0) return true

  if (!phone) return false

  const ssSession = await loadSsWhatsAppSession(phone, now)
  return ssSession.pencereAcik
}

export async function loadHatirlatmaWhatsAppContext(phone: string | null, cariKod: string) {
  const templateConfigured = hatirlatmaTemplateConfigured()
  const templateName = hatirlatmaTemplateName()
  const templateLanguage = hatirlatmaTemplateLanguage()
  const ssSession = phone ? await loadSsWhatsAppSession(phone) : null
  const pencereAcik = await hasWhatsAppConversationWindow(cariKod, phone)

  return {
    pencereAcik,
    ssOturumVar: ssSession?.oturumVar ?? false,
    ssPencereAcik: ssSession?.pencereAcik ?? false,
    templateConfigured,
    templateName: templateConfigured ? templateName : null,
    templateLanguage: templateConfigured ? templateLanguage : null,
    gonderimModu: pencereAcik ? ('text' as const) : templateConfigured ? ('template' as const) : ('blocked' as const),
  }
}

function buildTemplateComponents(params: string[]): WhatsAppTemplateComponent[] {
  return [
    {
      type: 'body',
      parameters: params.map((text) => ({ type: 'text' as const, text })),
    },
  ]
}

export async function sendHatirlatmaWhatsApp(options: {
  to: string
  cariKod: string
  body: string
  cari: CariBakiye
}): Promise<HatirlatmaWhatsAppSendResult> {
  const to = formatPhoneWhatsApp(options.to)
  const body = options.body.trim()
  if (!body) throw new Error('Mesaj metni boş olamaz.')

  const inWindow = await hasWhatsAppConversationWindow(options.cariKod, options.to)
  if (inWindow) {
    const result = await sendWhatsApp({ to, body })
    return { ...result, mode: 'text' }
  }

  const templateName = hatirlatmaTemplateName()
  if (!templateName) {
    throw new Error(
      'Bu numara SS sohbetinde yok ve son 24 saatte yazmadı. SS/tawkto gibi serbest metin yalnızca müşteri önce yazınca gider; soğuk hatırlatma için Meta onaylı şablon gerekir (WHATSAPP_HATIRLATMA_TEMPLATE).'
    )
  }

  const templateLanguage = hatirlatmaTemplateLanguage()
  const params = buildHatirlatmaTemplateParams(options.cari)
  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode: templateLanguage,
    components: buildTemplateComponents(params),
  })

  return {
    ...result,
    mode: 'template',
    templateName,
    templateLanguage,
  }
}

export function hatirlatmaDeliveryHint(mode: HatirlatmaWhatsAppSendMode) {
  if (mode === 'text') {
    return 'Müşteri son 24 saatte yazdığı için SS ile aynı şekilde serbest metin gönderildi.'
  }
  return 'Müşteri henüz yazmadığı için Meta onaylı şablon kullanıldı (SS soğuk mesaj göndermez).'
}
