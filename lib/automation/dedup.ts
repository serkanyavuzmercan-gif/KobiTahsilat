import 'server-only'
import { createAdminClient } from '../supabase/admin'
import {
  AUTOMATION_EMAIL_SEND_TIP,
  AUTOMATION_WHATSAPP_SEND_TIP,
} from '../automation-log'
import { ODEME_TALEP_EMAIL_TIP, WHATSAPP_SEND_TIP } from '../hatirlatma-log'
import type { Frekans } from './types'

/** Mutabakat gönderimleri (manuel + otomatik hepsi tek tip). */
export const MUTABAKAT_TIPS = ['mutabakat']
/** Ödeme talebi gönderimleri — manuel (e-posta/WhatsApp) + otomatik. */
export const ODEME_TALEP_TIPS = [
  ODEME_TALEP_EMAIL_TIP,
  WHATSAPP_SEND_TIP,
  AUTOMATION_EMAIL_SEND_TIP,
  AUTOMATION_WHATSAPP_SEND_TIP,
]

// Türkiye sabit UTC+3 (DST yok). TR-yerel tarih parçaları + TR gece-yarısı UTC anı.
const TR = 3 * 3600 * 1000

function trParts(now: Date) {
  const t = new Date(now.getTime() + TR)
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
    wd: t.getUTCDay(), // 0=Pazar..6=Cumartesi
  }
}

/** TR-yerel (y,mo,d) gece yarısının UTC Date'i (sent_at UTC ile kıyas için). */
function trMidnightUTC(y: number, mo: number, d: number): Date {
  return new Date(Date.UTC(y, mo, d) - TR)
}

/** Ayın ilk hafta-içi (Pzt-Cuma) günü (cron yalnız hafta içi çalışır). */
export function ilkIsGunuOfMonth(y: number, mo: number): number {
  for (let d = 1; d <= 7; d++) {
    const wd = new Date(Date.UTC(y, mo, d)).getUTCDay()
    if (wd !== 0 && wd !== 6) return d
  }
  return 1
}

/** hedefGun'den itibaren (o ay içinde) ilk hafta-içi gün. */
function ilkIsGunuOnOrAfter(y: number, mo: number, hedefGun: number): number {
  const gunSayisi = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  let d = Math.min(Math.max(1, hedefGun), gunSayisi)
  for (let i = 0; i < 8; i++) {
    const wd = new Date(Date.UTC(y, mo, d)).getUTCDay()
    if (wd !== 0 && wd !== 6) return d
    d = d + 1 > gunSayisi ? gunSayisi : d + 1
  }
  return d
}

/** Mutabakat bugün (TR) çalışmalı mı? ay_araligı kovasının başı + ayın ilk iş günü. */
export function mutabakatFireBugun(ayAraligi: number, now: Date): boolean {
  const { y, mo, d } = trParts(now)
  const aralik = Math.min(3, Math.max(1, Math.round(ayAraligi) || 1))
  const monthIndex = y * 12 + mo
  if (monthIndex % aralik !== 0) return false // bu ay kovanın başı değil
  return d === ilkIsGunuOfMonth(y, mo)
}

/** Mutabakat kova başlangıcı (bu periyotta zaten gönderildi mi kontrolü için). */
export function mutabakatBucketBasi(ayAraligi: number, now: Date): Date {
  const { y, mo } = trParts(now)
  const aralik = Math.min(3, Math.max(1, Math.round(ayAraligi) || 1))
  const monthIndex = y * 12 + mo
  const bucketIndex = Math.floor(monthIndex / aralik) * aralik
  return trMidnightUTC(Math.floor(bucketIndex / 12), bucketIndex % 12, 1)
}

/** Ödeme talebi bugün (TR) çalışmalı mı? (frekansa göre) */
export function odemeFireBugun(frekans: Frekans, now: Date): boolean {
  if (frekans.tur === 'gunluk') return true
  const { y, mo, d, wd } = trParts(now)
  if (frekans.tur === 'haftalik') {
    const haftaGun = wd === 0 ? 7 : wd // 1=Pzt..7=Paz
    return haftaGun === frekans.gun
  }
  return d === ilkIsGunuOnOrAfter(y, mo, frekans.gun)
}

/** Ödeme talebi periyot başlangıcı (bu periyotta zaten gönderildi mi kontrolü için). */
export function odemePeriodBasi(frekans: Frekans, now: Date): Date {
  const { y, mo, d, wd } = trParts(now)
  if (frekans.tur === 'gunluk') return trMidnightUTC(y, mo, d)
  if (frekans.tur === 'haftalik') {
    const pazartesiFark = (wd + 6) % 7 // Pazartesi=0
    return trMidnightUTC(y, mo, d - pazartesiFark)
  }
  return trMidnightUTC(y, mo, 1)
}

/**
 * Verilen carilerden, belirtilen tiplerde `since`'ten SONRA mesaj gönderilmiş olanların kümesi.
 * Manuel + otomatik hepsi sayılır (tek toplu sorgu).
 */
export async function contactedSince(
  cariKods: string[],
  tips: string[],
  since: Date
): Promise<Set<string>> {
  const set = new Set<string>()
  if (!cariKods.length) return set
  const admin = createAdminClient()
  for (let i = 0; i < cariKods.length; i += 300) {
    const { data, error } = await admin
      .from('mail_gonderim_log')
      .select('ilgili_id')
      .in('ilgili_tip', tips)
      .in('ilgili_id', cariKods.slice(i, i + 300))
      .gte('sent_at', since.toISOString())
    if (error) throw error
    for (const row of data || []) set.add(String(row.ilgili_id))
  }
  return set
}
