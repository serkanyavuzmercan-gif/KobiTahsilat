import 'server-only'
import { defaultSenderId, listMailSenders } from '../mail-senders'
import { hatirlatmaTemplateConfigured } from '../hatirlatma-whatsapp'
import { whatsAppConfigured, whatsAppSendEnabled } from '../whatsapp'
import {
  automationGloballyEnabled,
  loadAutomationSettings,
  loadWhatsAppUserConnection,
} from './settings'
import type { AutomationConnectionsStatus } from './types'

export async function loadAutomationConnectionsStatus(
  userId: string
): Promise<AutomationConnectionsStatus> {
  const [senders, whatsappUser] = await Promise.all([
    listMailSenders(userId),
    loadWhatsAppUserConnection(userId),
  ])

  const preferred = senders.find((sender) => sender.varsayilan) || senders[0]
  const userSenders = senders.filter((sender) => !sender.sistem)

  return {
    email_bagli: userSenders.length > 0 || Boolean(preferred),
    email_varsayilan: preferred?.email || null,
    whatsapp_kullanici: whatsappUser,
    whatsapp_api_yapilandirildi: whatsAppConfigured(),
    whatsapp_gonderim_acik: whatsAppSendEnabled(),
    mutabakat_gonderim_acik: process.env.MUTABAKAT_SEND_ENABLED !== 'false',
    otomasyon_global_acik: automationGloballyEnabled(),
  }
}

export async function assertAutomationReady(userId: string) {
  const [settings, connections] = await Promise.all([
    loadAutomationSettings(userId),
    loadAutomationConnectionsStatus(userId),
  ])

  const issues: string[] = []
  if (!automationGloballyEnabled()) {
    issues.push('Sistem yöneticisi OTOMATIK_TAHSILAT_ENABLED=true yapmalıdır.')
  }
  if (!connections.email_bagli) {
    issues.push('E-posta gönderici bağlantısı gerekli.')
  }
  if (!connections.whatsapp_kullanici.telefon) {
    issues.push('WhatsApp iletişim numaranızı bağlayın.')
  }
  if (!connections.whatsapp_api_yapilandirildi) {
    issues.push('WhatsApp API (WHATSAPP_ACCESS_TOKEN) yapılandırılmalıdır.')
  }
  if (!hatirlatmaTemplateConfigured()) {
    issues.push(
      'Soğuk WhatsApp hatırlatması için WHATSAPP_HATIRLATMA_TEMPLATE (Meta onaylı şablon) ayarlanmalıdır.'
    )
  }

  const activeRules = settings.kurallar.filter((rule) => rule.aktif)
  if (!activeRules.length) {
    issues.push('En az bir aktif otomasyon kuralı tanımlayın.')
  }

  return { settings, connections, issues }
}

export { defaultSenderId }
