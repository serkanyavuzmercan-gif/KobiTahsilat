import 'server-only'
import { gmailSendConfigured } from '../gmail-send'
import { loadBotDurum, whatsAppBotEnabled } from '../whatsapp-kuyruk'
import { automationGloballyEnabled, loadAutomationSettings } from './settings'
import type { AutomationConnectionsStatus } from './types'

export async function loadAutomationConnectionsStatus(
  _userId: string
): Promise<AutomationConnectionsStatus> {
  const botDurum = await loadBotDurum()

  // E-posta gönderimi sabit: Gmail (GMAIL_SENDER = serkan.mercan@) + servis hesabı.
  const gmailReady = gmailSendConfigured()
  const gmailSender = (process.env.GMAIL_SENDER || '').trim() || null

  return {
    email_bagli: gmailReady,
    email_varsayilan: gmailSender,
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
    issues.push('Gmail gönderimi yapılandırılmadı (GOOGLE_SA_KEY_B64 + GMAIL_SENDER).')
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
