import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from './supabase/admin'

export type OdemeLinkRow = {
  id: string
  merchant_oid: string
  token: string
  cari_kod: string
  firma_adi: string | null
  tutar_kurus: number
  editable: boolean
  email: string | null
  paytr_url: string | null
  durum: 'olusturuldu' | 'odendi' | 'basarisiz' | 'iptal'
  odenen_kurus: number | null
  test_mode: boolean
  created_at: string
  odendi_at: string | null
}

/** PayTR merchant_oid: yalnız alfanumerik olmalı (cari_kod noktalı) + her link tekil. */
export function generateMerchantOid(cariKod: string): string {
  const kod = cariKod.replace(/[^a-zA-Z0-9]/g, '')
  const rnd = crypto.randomBytes(6).toString('hex')
  const ts = crypto.randomBytes(4).toString('hex')
  return `HT${kod}${ts}${rnd}`.slice(0, 62)
}

/** Kendi domainimizdeki kısa link token'ı (tahmin edilemez; DB'den lookup edilir). */
export function generateLinkToken(): string {
  return crypto.randomBytes(20).toString('base64url')
}

export function shortLinkUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(/\/$/, '')
  return `${base}/o/${encodeURIComponent(token)}`
}

export async function insertOdemeLink(row: {
  merchantOid: string
  token: string
  cariKod: string
  firmaAdi: string | null
  tutarKurus: number
  editable: boolean
  email: string | null
  paytrUrl: string
  testMode: boolean
  userId?: string | null
}): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.from('odeme_linkleri').insert({
    merchant_oid: row.merchantOid,
    token: row.token,
    cari_kod: row.cariKod,
    firma_adi: row.firmaAdi,
    tutar_kurus: row.tutarKurus,
    editable: row.editable,
    email: row.email,
    paytr_url: row.paytrUrl,
    durum: 'olusturuldu',
    test_mode: row.testMode,
    olusturan_user_id: row.userId || null,
  })
  if (error) throw new Error(error.message)
}

export async function findLinkByToken(token: string): Promise<OdemeLinkRow | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('odeme_linkleri').select('*').eq('token', token).maybeSingle()
  return (data as OdemeLinkRow) || null
}

/**
 * Callback: merchant_oid ile satırı bulup öder olarak işaretler. İdempotent — zaten 'odendi' ise
 * dokunmaz (PayTR aynı bildirimi tekrar gönderebilir). Satır tekil (merchant_oid UNIQUE) → race-safe.
 */
export async function markLinkFromCallback(params: {
  merchantOid: string
  basarili: boolean
  totalAmountKurus: number | null
  raw: Record<string, string>
}): Promise<{ bulundu: boolean; zatenIslendi: boolean }> {
  const admin = createAdminClient()
  const { data: mevcut } = await admin
    .from('odeme_linkleri')
    .select('id,durum')
    .eq('merchant_oid', params.merchantOid)
    .maybeSingle()
  if (!mevcut) return { bulundu: false, zatenIslendi: false }
  if (mevcut.durum === 'odendi') return { bulundu: true, zatenIslendi: true }

  await admin
    .from('odeme_linkleri')
    .update({
      durum: params.basarili ? 'odendi' : 'basarisiz',
      odenen_kurus: params.totalAmountKurus,
      odendi_at: params.basarili ? new Date().toISOString() : null,
      callback_ham: params.raw,
    })
    .eq('merchant_oid', params.merchantOid)
    .neq('durum', 'odendi')
  return { bulundu: true, zatenIslendi: false }
}

/**
 * Son `since` tarihinden beri PayTR'den ödeme ALINMIŞ cari kodları (otomasyon askıya alma için).
 * Mikro senkronu güncellenene kadar "az önce ödedim, neden yine istiyorsunuz" durumunu önler.
 */
export async function recentlyPaidCariKods(sinceIso: string): Promise<Set<string>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('odeme_linkleri')
    .select('cari_kod')
    .eq('durum', 'odendi')
    .gte('odendi_at', sinceIso)
  return new Set((data || []).map((r) => String(r.cari_kod)))
}
