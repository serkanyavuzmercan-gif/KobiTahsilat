import 'server-only'
import { cariOrtalamaGecikmeGun, formatGecikmeGun } from './gecikme'
import { CARI_WHATSAPP_YANIT_TIP } from './cari-yanit-log'
import type { CariBakiye } from './types'
import { formatTL } from './types'
import { formatPhoneWhatsApp } from './phone'
import { createAdminClient } from './supabase/admin'
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
  return (data?.length ?? 0) > 0
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

  const inWindow = await hasWhatsAppConversationWindow(options.cariKod)
  if (inWindow) {
    const result = await sendWhatsApp({ to, body })
    return { ...result, mode: 'text' }
  }

  const templateName = hatirlatmaTemplateName()
  if (!templateName) {
    throw new Error(
      'Alıcı son 24 saatte WhatsApp yazmadığı için serbest metin teslim edilmez. Meta Business Manager\'da onaylı bir hatırlatma şablonu oluşturup WHATSAPP_HATIRLATMA_TEMPLATE ortam değişkenine şablon adını yazın.'
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
    return 'Müşteri son 24 saatte yazdığı için serbest metin gönderildi.'
  }
  return 'İlk temas veya 24 saatten uzun süre geçtiği için Meta onaylı şablon kullanıldı.'
}
