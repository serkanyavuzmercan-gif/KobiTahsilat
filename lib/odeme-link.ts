import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from './supabase/admin'
import { createPaymentLink, getPaytrConfig, paytrYapili } from './paytr'

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

/**
 * Kendi kısa link token'ımız. Aynı zamanda PayTR'ye `callback_id` olarak gönderilir ve callback'te
 * geri döner → eşleştirme anahtarı. Yalnız alfanumerik (PayTR callback_id kısıtı için güvenli).
 */
export function generateLinkToken(): string {
  return crypto.randomBytes(18).toString('hex')
}

export function shortLinkUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(/\/$/, '')
  return `${base}/o/${encodeURIComponent(token)}`
}

export async function insertOdemeLink(row: {
  token: string
  paytrLinkId: string
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
    token: row.token,
    paytr_link_id: row.paytrLinkId,
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

/**
 * Bir cari için PayTR ödeme linki üretir + kaydeder, kendi kısa linkimizi döner.
 * Mail/panel ortak yardımcısı. PayTR yoksa veya hata olursa null (ASLA throw etmez → gönderimi bozmaz).
 */
export async function olusturVeKaydetOdemeLink(opts: {
  cariKod: string
  firmaAdi: string | null
  cariEmail: string | null
  amountKurus: number
  userId?: string | null
}): Promise<{ kisaLink: string; paytrUrl: string; qr: string | null } | null> {
  try {
    if (!paytrYapili() || !Number.isFinite(opts.amountKurus) || opts.amountKurus <= 0) return null
    const token = generateLinkToken()
    const hashEmail =
      opts.cariEmail || process.env.PAYTR_FALLBACK_EMAIL || process.env.GMAIL_SENDER || 'finans@hidroteknik.com.tr'
    const link = await createPaymentLink({
      name: `${opts.firmaAdi || opts.cariKod} — cari hesap ödemesi`,
      amountKurus: opts.amountKurus,
      email: hashEmail,
      callbackId: token,
    })
    if (!link.ok) return null
    await insertOdemeLink({
      token,
      paytrLinkId: link.id,
      cariKod: opts.cariKod,
      firmaAdi: opts.firmaAdi,
      tutarKurus: opts.amountKurus,
      editable: true,
      email: opts.cariEmail,
      paytrUrl: link.url,
      testMode: getPaytrConfig()?.testMode ?? false,
      userId: opts.userId ?? null,
    })
    return { kisaLink: shortLinkUrl(token), paytrUrl: link.url, qr: link.qr ?? null }
  } catch {
    return null
  }
}

/**
 * Bir cari için AKTİF (henüz ödenmemiş, son 7 günde üretilmiş) linki tekrar kullanır; yoksa yeni üretir.
 * Döküm PDF'i gibi müşteri her açtığında çağrılan yerlerde link enflasyonunu önler. Hata → null.
 */
export async function getOrCreateOdemeLinkForCari(opts: {
  cariKod: string
  firmaAdi: string | null
  cariEmail: string | null
  amountKurus: number
}): Promise<{ kisaLink: string } | null> {
  try {
    if (!paytrYapili() || !(opts.amountKurus > 0)) return null
    const admin = createAdminClient()
    const enEski = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await admin
      .from('odeme_linkleri')
      .select('token')
      .eq('cari_kod', opts.cariKod)
      .eq('durum', 'olusturuldu')
      .eq('tutar_kurus', opts.amountKurus) // tutar değiştiyse eski/yanlış linki tekrar kullanma
      .gte('created_at', enEski)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.token) return { kisaLink: shortLinkUrl(String(data.token)) }
    const yeni = await olusturVeKaydetOdemeLink(opts)
    return yeni ? { kisaLink: yeni.kisaLink } : null
  } catch {
    return null
  }
}

export async function findLinkByToken(token: string): Promise<OdemeLinkRow | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('odeme_linkleri').select('*').eq('token', token).maybeSingle()
  return (data as OdemeLinkRow) || null
}

/**
 * Callback: callback_id (=bizim token) ile satırı bulup öder olarak işaretler. PayTR'nin ürettiği
 * merchant_oid'i de o an yazar. İdempotent — zaten 'odendi' ise dokunmaz (PayTR aynı bildirimi
 * tekrar gönderebilir; yalnız ilki dikkate alınır). Satır token UNIQUE → race-safe.
 */
export async function markLinkFromCallback(params: {
  callbackId: string
  merchantOid: string
  basarili: boolean
  totalAmountKurus: number | null
  raw: Record<string, string>
}): Promise<{ bulundu: boolean; zatenIslendi: boolean }> {
  const admin = createAdminClient()
  const { data: mevcut } = await admin
    .from('odeme_linkleri')
    .select('id,durum')
    .eq('token', params.callbackId)
    .maybeSingle()
  if (!mevcut) return { bulundu: false, zatenIslendi: false }
  if (mevcut.durum === 'odendi') return { bulundu: true, zatenIslendi: true }

  await admin
    .from('odeme_linkleri')
    .update({
      merchant_oid: params.merchantOid,
      durum: params.basarili ? 'odendi' : 'basarisiz',
      odenen_kurus: params.totalAmountKurus,
      odendi_at: params.basarili ? new Date().toISOString() : null,
      callback_ham: params.raw,
    })
    .eq('token', params.callbackId)
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
