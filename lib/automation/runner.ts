import 'server-only'
import { isBusinessDay } from '../business-days'
import { loadSnapshot } from '../data'
import { sendMail } from '../mail'
import { buildHatirlatmaMessage } from '../hatirlatma'
import { loadHatirlatmaCariler } from '../hatirlatma-data'
import { loadMutabakatCariler } from '../mutabakat-data'
import { formatPhoneWhatsApp } from '../phone'
import { sendHatirlatmaWhatsApp } from '../hatirlatma-whatsapp'
import { whatsAppBotEnabled } from '../whatsapp-kuyruk'
import {
  AUTOMATION_EMAIL_SEND_TIP,
  AUTOMATION_LOG_KAYNAK,
  AUTOMATION_RUN_TIP,
  AUTOMATION_WHATSAPP_SEND_TIP,
} from '../automation-log'
import { createAdminClient } from '../supabase/admin'
import { automationGloballyEnabled, loadAutomationSettings } from './settings'
import { collectEmailCandidates, collectWhatsAppCandidates } from './eligibility'
import { buildHatirlatmaEmail } from './email-template'
import type { AutomationRunCandidate, AutomationRunResult, AutomationSettings } from './types'

function isWithinWorkHour(calismaSaati: string, now = new Date()) {
  const [hour, minute] = calismaSaati.split(':').map((part) => Number(part))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true

  const turkeyNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
  )
  const currentMinutes = turkeyNow.getHours() * 60 + turkeyNow.getMinutes()
  const targetMinutes = hour * 60 + minute
  return currentMinutes >= targetMinutes
}

async function logAutomationRun(userId: string, result: AutomationRunResult) {
  const admin = createAdminClient()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: userId,
    ilgili_tip: AUTOMATION_RUN_TIP,
    mail_to: userId,
    subject: `Otomasyon: ${result.gonderilen} gönderim, ${result.aday_sayisi} aday`,
    body_preview: JSON.stringify({
      taslak_mod: result.taslak_mod,
      aday_sayisi: result.aday_sayisi,
      gonderilen: result.gonderilen,
      atlanan: result.atlanan,
      hatalar: result.hatalar.slice(0, 5),
    }),
    kaynak: AUTOMATION_LOG_KAYNAK,
    sent_at: result.bitti,
  })
  if (error) console.error('[automation-run-log]', error.message)
}

async function sendAutomationEmail(
  userId: string,
  cariKod: string,
  taslakMod: boolean
): Promise<void> {
  const mutabakatCariler = await loadMutabakatCariler()
  const cari = mutabakatCariler.find((item) => item.cari_kod === cariKod)
  if (!cari) throw new Error('Cari bulunamadı.')
  if (!cari.email) throw new Error('E-posta adresi yok.')
  if (cari.mutabakat_gonderim_engelli) throw new Error('E-posta bekleme süresi aktif.')
  if (process.env.MUTABAKAT_SEND_ENABLED === 'false') {
    throw new Error('E-posta gönderimi kapalı.')
  }

  const snapshot = await loadSnapshot()
  const email = buildHatirlatmaEmail(cari, snapshot.snapshot_tarihi)

  if (taslakMod) return

  // Gönderen sabit: Gmail (GMAIL_SENDER = serkan.mercan@). Yanıtlar aynı kutuya.
  const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
  const sentAt = new Date().toISOString()

  await sendMail({
    to: cari.email_adresleri,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })

  const admin = createAdminClient()
  await admin.from('mail_gonderim_log').insert({
    mail_to: cari.email_adresleri.join(';'),
    mail_from: from,
    subject: email.subject,
    body_preview: email.text.slice(0, 240),
    kaynak: AUTOMATION_LOG_KAYNAK,
    ilgili_id: cari.cari_kod,
    ilgili_tip: AUTOMATION_EMAIL_SEND_TIP,
    sent_at: sentAt,
  })
}

async function sendAutomationWhatsApp(
  userId: string,
  cariKod: string,
  taslakMod: boolean
): Promise<void> {
  if (!whatsAppBotEnabled()) throw new Error('WhatsApp gönderimi kapalı.')

  const cariler = await loadHatirlatmaCariler()
  const cari = cariler.find((item) => item.cari_kod === cariKod)
  if (!cari) throw new Error('Cari bulunamadı.')
  if (!cari.telefon) throw new Error('Telefon yok.')

  const snapshot = await loadSnapshot()
  const message = buildHatirlatmaMessage(cari, snapshot.snapshot_tarihi)

  if (taslakMod) return

  const sentAt = new Date().toISOString()
  const kuyruk = await sendHatirlatmaWhatsApp({
    to: formatPhoneWhatsApp(cari.telefon),
    cariKod: cari.cari_kod,
    body: message.body,
    cari,
  })

  const admin = createAdminClient()
  await admin.from('mail_gonderim_log').insert({
    mail_to: cari.telefon,
    subject: message.ozet,
    body_preview: JSON.stringify({ kuyruk_id: kuyruk.kuyrukId, mesaj: message.body.slice(0, 200) }),
    kaynak: AUTOMATION_LOG_KAYNAK,
    ilgili_id: cari.cari_kod,
    ilgili_tip: AUTOMATION_WHATSAPP_SEND_TIP,
    sent_at: sentAt,
  })
}

async function collectCandidatesForUser(settings: AutomationSettings) {
  const [mutabakatCariler, hatirlatmaCariler] = await Promise.all([
    loadMutabakatCariler(),
    loadHatirlatmaCariler(),
  ])

  const candidates: AutomationRunCandidate[] = []

  for (const rule of settings.kurallar.filter((item) => item.aktif)) {
    if (rule.kanal === 'email') {
      candidates.push(...collectEmailCandidates(rule, mutabakatCariler))
    } else {
      candidates.push(...collectWhatsAppCandidates(rule, hatirlatmaCariler))
    }
  }

  const unique = new Map<string, AutomationRunCandidate>()
  for (const candidate of candidates) {
    const key = `${candidate.kanal}:${candidate.cari_kod}`
    const existing = unique.get(key)
    if (!existing || candidate.ortalama_gecikme_gun > existing.ortalama_gecikme_gun) {
      unique.set(key, candidate)
    }
  }

  return [...unique.values()].sort(
    (a, b) => b.ortalama_gecikme_gun - a.ortalama_gecikme_gun
  )
}

export async function runAutomationForUser(
  userId: string,
  options?: { force?: boolean; dryRun?: boolean }
): Promise<AutomationRunResult> {
  const basladi = new Date().toISOString()
  const settings = await loadAutomationSettings(userId)
  const taslakMod = options?.dryRun ?? settings.taslak_mod
  const hatalar: string[] = []
  let gonderilen = 0
  let atlanan = 0

  if (!settings.otomasyon_aktif && !options?.force && !options?.dryRun) {
    return {
      basladi,
      bitti: new Date().toISOString(),
      taslak_mod: taslakMod,
      kullanici_id: userId,
      aday_sayisi: 0,
      gonderilen: 0,
      atlanan: 0,
      hatalar: ['Otomasyon bu kullanıcı için kapalı.'],
      adaylar: [],
    }
  }

  if (!options?.dryRun && !automationGloballyEnabled()) {
    return {
      basladi,
      bitti: new Date().toISOString(),
      taslak_mod: taslakMod,
      kullanici_id: userId,
      aday_sayisi: 0,
      gonderilen: 0,
      atlanan: 0,
      hatalar: ['OTOMATIK_TAHSILAT_ENABLED=true yapılmadan canlı gönderim yapılamaz.'],
      adaylar: [],
    }
  }

  const now = new Date()
  if (!options?.force && !options?.dryRun) {
    if (settings.sadece_is_gunu && !isBusinessDay(now)) {
      return {
        basladi,
        bitti: new Date().toISOString(),
        taslak_mod: taslakMod,
        kullanici_id: userId,
        aday_sayisi: 0,
        gonderilen: 0,
        atlanan: 0,
        hatalar: ['Bugün iş günü değil; otomasyon atlandı.'],
        adaylar: [],
      }
    }
    if (!isWithinWorkHour(settings.calisma_saati, now)) {
      return {
        basladi,
        bitti: new Date().toISOString(),
        taslak_mod: taslakMod,
        kullanici_id: userId,
        aday_sayisi: 0,
        gonderilen: 0,
        atlanan: 0,
        hatalar: [`Çalışma saati (${settings.calisma_saati}) henüz gelmedi.`],
        adaylar: [],
      }
    }
  }

  const adaylar = await collectCandidatesForUser(settings)

  for (const aday of adaylar) {
    if (aday.engel) {
      atlanan++
      continue
    }

    try {
      if (aday.kanal === 'email') {
        await sendAutomationEmail(userId, aday.cari_kod, taslakMod)
      } else {
        await sendAutomationWhatsApp(userId, aday.cari_kod, taslakMod)
      }
      if (!taslakMod) gonderilen++
    } catch (cause) {
      atlanan++
      hatalar.push(
        `${aday.cari_kod} (${aday.kanal}): ${
          cause instanceof Error ? cause.message : 'Gönderilemedi'
        }`
      )
    }
  }

  const result: AutomationRunResult = {
    basladi,
    bitti: new Date().toISOString(),
    taslak_mod: taslakMod,
    kullanici_id: userId,
    aday_sayisi: adaylar.length,
    gonderilen: taslakMod ? 0 : gonderilen,
    atlanan,
    hatalar,
    adaylar,
  }

  await logAutomationRun(userId, result)
  return result
}

export async function runAutomationForAllUsers(options?: { force?: boolean; dryRun?: boolean }) {
  const { listAutomationUserIds } = await import('./settings')
  const userIds = await listAutomationUserIds()
  const results: AutomationRunResult[] = []

  for (const userId of userIds) {
    results.push(await runAutomationForUser(userId, options))
  }

  return results
}
