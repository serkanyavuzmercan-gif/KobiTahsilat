import 'server-only'
import type { CariBakiye } from './types'
import { enqueueWhatsAppDM, loadBotDurum, whatsAppBotEnabled } from './whatsapp-kuyruk'

/**
 * Tahsilat WhatsApp hatırlatması — ss ile ortak Baileys kuyruğuna yazar (Meta Cloud API değil).
 * Baileys serbest metni istediğimiz numaraya gönderdiği için 24 saat penceresi / onaylı şablon
 * gerekmez; mesaj kuyruğa alınır, ofis botu gönderir.
 */

export type HatirlatmaWhatsAppSendResult = {
  mode: 'kuyruk'
  kuyrukId: string
  jid: string
}

export async function sendHatirlatmaWhatsApp(options: {
  to: string
  cariKod: string
  body: string
  cari: CariBakiye
}): Promise<HatirlatmaWhatsAppSendResult> {
  const body = options.body.trim()
  if (!body) throw new Error('Mesaj metni boş olamaz.')

  const { kuyrukId, jid } = await enqueueWhatsAppDM({
    telefon: options.to,
    mesaj: body,
    firmaAdi: options.cari.firma_adi,
    etiket: `Tahsilat · ${options.cari.cari_kod}`,
  })

  return { mode: 'kuyruk', kuyrukId, jid }
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
  const bot = await loadBotDurum()
  return {
    botEnabled: whatsAppBotEnabled(),
    botCevrimici: bot.cevrimici,
    sonPoll: bot.son_poll_at,
    sonGonderim: bot.son_gonderim_at,
  }
}

export function hatirlatmaDeliveryHint(): string {
  return 'Mesaj WhatsApp kuyruğuna alındı; ofis botu sırayla gönderir. Durumu yukarıdan takip edebilirsiniz.'
}
