import 'server-only'
import { isBusinessDay } from '../business-days'
import { loadSnapshot } from '../data'
import { sendMail } from '../mail'
import { buildHatirlatmaMessage } from '../hatirlatma'
import { loadHatirlatmaCariler } from '../hatirlatma-data'
import { loadMutabakatCariler } from '../mutabakat-data'
import { buildMutabakatEmail } from '../mutabakat'
import { createMutabakatToken } from '../mutabakat-token'
import { insertMailGonderimLog } from '../mail-gonderim-log'
import { MAIL_LOG_KAYNAK } from '../mutabakat-log'
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
import {
  automationAnyActive,
  automationGloballyEnabled,
  loadAutomationSettings,
} from './settings'
import { collectMutabakatCandidates, collectOdemeTalepCandidates } from './eligibility'
import { buildHatirlatmaEmail } from './email-template'
import type { AutomationRunCandidate, AutomationRunResult, AutomationSettings } from './types'

function isWithinWorkHour(calismaSaati: string, now = new Date()) {
  const [hour, minute] = calismaSaati.split(':').map((part) => Number(part))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return true

  const turkeyNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
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

/** Otomatik MUTABAKAT e-postası (token + onay/itiraz linkleri; manuel gönderimle aynı). */
async function sendAutomationMutabakat(
  userId: string,
  cariKod: string,
  taslakMod: boolean
): Promise<void> {
  if (process.env.MUTABAKAT_SEND_ENABLED === 'false') throw new Error('Mutabakat gönderimi kapalı.')

  const cariler = await loadMutabakatCariler()
  const cari = cariler.find((item) => item.cari_kod === cariKod)
  if (!cari) throw new Error('Cari bulunamadı.')
  const alici = cari.email_adresleri[0]
  if (!alici) throw new Error('Alıcı e-posta seçili değil.')
  if (cari.mutabakat_gonderim_engelli) throw new Error('8 iş günü dolmadı.')

  const snapshot = await loadSnapshot()
  const tarih = snapshot.snapshot_tarihi
  const token = createMutabakatToken(cari.cari_kod, tarih, cari.bakiye)
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr'
  ).replace(/\/$/, '')
  const email = buildMutabakatEmail(cari, tarih, {
    onayUrl: `${baseUrl}/mutabakat/onay/${encodeURIComponent(token)}`,
    itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
  })

  if (taslakMod) return

  const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
  const sentAt = new Date().toISOString()
  await sendMail({ to: [alici], subject: email.subject, html: email.html, text: email.text })
  await insertMailGonderimLog({
    mail_to: alici,
    mail_from: from,
    subject: email.subject,
    body_preview: `${cari.firma_adi} mutabakatı (otomatik) gönderildi`,
    kaynak: MAIL_LOG_KAYNAK,
    ilgili_id: cari.cari_kod,
    ilgili_tip: 'mutabakat',
    sent_at: sentAt,
    gonderen_user_id: userId,
  })
}

/** Otomatik ÖDEME TALEBİ e-postası (hatırlatma içeriği; varsayılan alıcı override-farkında). */
async function sendAutomationOdemeEmail(
  userId: string,
  cariKod: string,
  taslakMod: boolean
): Promise<void> {
  if (process.env.MUTABAKAT_SEND_ENABLED === 'false') throw new Error('E-posta gönderimi kapalı.')

  const cariler = await loadMutabakatCariler()
  const cari = cariler.find((item) => item.cari_kod === cariKod)
  if (!cari) throw new Error('Cari bulunamadı.')
  if (!cari.email) throw new Error('Doğrulanmış e-posta yok.')

  const snapshot = await loadSnapshot()
  const email = buildHatirlatmaEmail(cari, snapshot.snapshot_tarihi)

  if (taslakMod) return

  const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
  const sentAt = new Date().toISOString()
  // ASLA tüm adreslere birden gitme; yalnız varsayılan (ilk) adres.
  const otoAlicilar = cari.email_adresleri.slice(0, 1)
  await sendMail({ to: otoAlicilar, subject: email.subject, html: email.html, text: email.text })

  const admin = createAdminClient()
  await admin.from('mail_gonderim_log').insert({
    mail_to: otoAlicilar.join(';'),
    mail_from: from,
    subject: email.subject,
    body_preview: email.text.slice(0, 240),
    kaynak: AUTOMATION_LOG_KAYNAK,
    ilgili_id: cari.cari_kod,
    ilgili_tip: AUTOMATION_EMAIL_SEND_TIP,
    sent_at: sentAt,
  })
}

/** Otomatik ÖDEME TALEBİ WhatsApp (onaylı şablon; resmi Cloud API). */
async function sendAutomationWhatsApp(
  _userId: string,
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
  const gonderim = await sendHatirlatmaWhatsApp({
    to: formatPhoneWhatsApp(cari.telefon),
    cari,
    snapshotTarihi: snapshot.snapshot_tarihi,
  })

  const admin = createAdminClient()
  await admin.from('mail_gonderim_log').insert({
    mail_to: cari.telefon,
    subject: message.ozet,
    body_preview: JSON.stringify({ wamid: gonderim.wamid, mesaj: message.ozet.slice(0, 200) }),
    kaynak: AUTOMATION_LOG_KAYNAK,
    ilgili_id: cari.cari_kod,
    ilgili_tip: AUTOMATION_WHATSAPP_SEND_TIP,
    sent_at: sentAt,
  })
}

async function collectCandidatesForUser(
  settings: AutomationSettings
): Promise<AutomationRunCandidate[]> {
  const out: AutomationRunCandidate[] = []

  if (settings.odeme_talebi.aktif) {
    const hatirlatmaCariler = await loadHatirlatmaCariler()
    out.push(
      ...collectOdemeTalepCandidates(hatirlatmaCariler, {
        minGun: settings.odeme_talebi.min_ortalama_gecikme_gun,
        minTutar: settings.odeme_talebi.min_gecikmis_tutar,
        kanal: settings.odeme_talebi.kanal,
      })
    )
  }
  if (settings.mutabakat.aktif) {
    const mutabakatCariler = await loadMutabakatCariler()
    out.push(...collectMutabakatCandidates(mutabakatCariler, settings.mutabakat.taban_bakiye))
  }

  const unique = new Map<string, AutomationRunCandidate>()
  for (const candidate of out) {
    unique.set(`${candidate.tur}:${candidate.kanal}:${candidate.cari_kod}`, candidate)
  }
  return [...unique.values()].sort(
    (a, b) => (b.ortalama_gecikme_gun || 0) - (a.ortalama_gecikme_gun || 0)
  )
}

function earlyResult(
  basladi: string,
  userId: string,
  taslakMod: boolean,
  hata: string
): AutomationRunResult {
  return {
    basladi,
    bitti: new Date().toISOString(),
    taslak_mod: taslakMod,
    kullanici_id: userId,
    aday_sayisi: 0,
    gonderilen: 0,
    atlanan: 0,
    hatalar: [hata],
    adaylar: [],
  }
}

export async function runAutomationForUser(
  userId: string,
  options?: { force?: boolean; dryRun?: boolean }
): Promise<AutomationRunResult> {
  const basladi = new Date().toISOString()
  const settings = await loadAutomationSettings(userId)
  // "Genel taslak" göstergesi: her iki blok da deneme modundaysa (rapor için).
  const taslakMod =
    options?.dryRun ?? (settings.mutabakat.taslak_mod && settings.odeme_talebi.taslak_mod)
  const hatalar: string[] = []
  let gonderilen = 0
  let atlanan = 0

  if (!automationAnyActive(settings) && !options?.force && !options?.dryRun) {
    return earlyResult(basladi, userId, taslakMod, 'Otomasyon kapalı (iki blok da pasif).')
  }
  if (!options?.dryRun && !automationGloballyEnabled()) {
    return earlyResult(
      basladi,
      userId,
      taslakMod,
      'OTOMATIK_TAHSILAT_ENABLED=true yapılmadan canlı gönderim yapılamaz.'
    )
  }

  const now = new Date()
  if (!options?.force && !options?.dryRun) {
    if (settings.sadece_is_gunu && !isBusinessDay(now)) {
      return earlyResult(basladi, userId, taslakMod, 'Bugün iş günü değil; otomasyon atlandı.')
    }
    if (!isWithinWorkHour(settings.calisma_saati, now)) {
      return earlyResult(
        basladi,
        userId,
        taslakMod,
        `Çalışma saati (${settings.calisma_saati}) henüz gelmedi.`
      )
    }
  }

  const adaylar = await collectCandidatesForUser(settings)

  for (const aday of adaylar) {
    if (aday.engel) {
      atlanan++
      continue
    }
    // Deneme modu blok-bazlı: dryRun her şeyi taslak yapar; aksi halde ilgili bloğun modu.
    const taslak = options?.dryRun
      ? true
      : aday.tur === 'mutabakat'
        ? settings.mutabakat.taslak_mod
        : settings.odeme_talebi.taslak_mod
    try {
      if (aday.tur === 'mutabakat') {
        await sendAutomationMutabakat(userId, aday.cari_kod, taslak)
      } else if (aday.kanal === 'email') {
        await sendAutomationOdemeEmail(userId, aday.cari_kod, taslak)
      } else {
        await sendAutomationWhatsApp(userId, aday.cari_kod, taslak)
      }
      if (!taslak) gonderilen++
    } catch (cause) {
      atlanan++
      hatalar.push(
        `${aday.cari_kod} (${aday.tur}/${aday.kanal}): ${
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
    gonderilen,
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
