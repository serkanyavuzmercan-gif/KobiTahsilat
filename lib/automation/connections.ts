import 'server-only'
import { gmailSendConfigured } from '../gmail-send'
import { whatsAppBotEnabled } from '../whatsapp-kuyruk'
import { whatsAppCloudYapili } from '../whatsapp-cloud'
import {
  automationAnyActive,
  automationGloballyEnabled,
  loadAutomationSettings,
} from './settings'
import type { AutomationConnectionsStatus } from './types'

export async function loadAutomationConnectionsStatus(
  _userId: string
): Promise<AutomationConnectionsStatus> {
  // E-posta gönderimi sabit: Gmail (GMAIL_SENDER) + servis hesabı.
  const gmailReady = gmailSendConfigured()
  const gmailSender = (process.env.GMAIL_SENDER || '').trim() || null

  return {
    email_bagli: gmailReady,
    email_varsayilan: gmailSender,
    // WhatsApp artık resmi Cloud API (Baileys değil): token + phone number id tanımlıysa hazır.
    whatsapp_api_yapilandirildi: whatsAppCloudYapili(),
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
  // WhatsApp yalnız Ödeme Talebi bloğu WhatsApp kanalı açıkken şart.
  const whatsappGerekli =
    settings.odeme_talebi.aktif &&
    (settings.odeme_talebi.kanal === 'whatsapp' || settings.odeme_talebi.kanal === 'her-ikisi')
  if (whatsappGerekli && !connections.whatsapp_api_yapilandirildi) {
    issues.push('WhatsApp Cloud API yapılandırılmadı (WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID).')
  }

  if (!automationAnyActive(settings)) {
    issues.push('En az bir otomasyon bloğunu (mutabakat veya ödeme talebi) etkinleştirin.')
  }

  return { settings, connections, issues }
}
