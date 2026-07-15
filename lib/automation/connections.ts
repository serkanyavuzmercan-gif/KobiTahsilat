import 'server-only'
import { defaultSenderId, listMailSenders } from '../mail-senders'
import { loadBotDurum, whatsAppBotEnabled } from '../whatsapp-kuyruk'
import { automationGloballyEnabled, loadAutomationSettings } from './settings'
import type { AutomationConnectionsStatus } from './types'

export async function loadAutomationConnectionsStatus(
  userId: string
): Promise<AutomationConnectionsStatus> {
  const [senders, botDurum] = await Promise.all([listMailSenders(userId), loadBotDurum()])

  const preferred = senders.find((sender) => sender.varsayilan) || senders[0]
  const userSenders = senders.filter((sender) => !sender.sistem)

  return {
    email_bagli: userSenders.length > 0 || Boolean(preferred),
    email_varsayilan: preferred?.email || null,
    // Baileys ofis botu heartbeat'i son 90 sn içinde geldiyse "bağlı".
    whatsapp_api_yapilandirildi: botDurum.cevrimici,
    whatsapp_gonderim_acik: whatsAppBotEnabled(),
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
  if (!connections.whatsapp_api_yapilandirildi) {
    issues.push('Ofis WhatsApp botu çevrimiçi değil (son heartbeat yok). Bot PC\'sini kontrol edin.')
  }

  const activeRules = settings.kurallar.filter((rule) => rule.aktif)
  if (!activeRules.length) {
    issues.push('En az bir aktif otomasyon kuralı tanımlayın.')
  }

  return { settings, connections, issues }
}

export { defaultSenderId }
