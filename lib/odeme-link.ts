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
  durum: 'olusturuldu' | 'odendi' | 'kismi' | 'basarisiz' | 'iptal'
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
    // Çift tahsilat engeli: bu cari için AYNI tutar son 3 günde TAM ödendiyse yeni ödenebilir link
    // üretme; ödenen linkin /o'sunu dön (müşteri "ödeme alınmış" görür). Snapshot gecikmesi (24s) kapısı.
    const paid = await recentPaidLinkUrl(opts.cariKod, opts.amountKurus)
    if (paid) return { kisaLink: paid, paytrUrl: '', qr: null }

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
 * Aynı cari için AYNI tutar son 3 günde TAM ödendiyse (durum='odendi'), o ödenen linkin /o URL'sini
 * döner; yoksa null. Çift tahsilat engeli — snapshot gecikmesinde (gecikmiş tutar düşene kadar) aynı
 * borç için ikinci ödenebilir link üretilmesini önler. Sadece EŞİT tutar kilitler; kısmi/farklı geçer.
 */
async function recentPaidLinkUrl(cariKod: string, amountKurus: number): Promise<string | null> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data } = await admin
    .from('odeme_linkleri')
    .select('token')
    .eq('cari_kod', cariKod)
    .eq('durum', 'odendi')
    .eq('tutar_kurus', amountKurus)
    .gte('odendi_at', since)
    .order('odendi_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.token ? shortLinkUrl(String(data.token)) : null
}

/**
 * TÜM kanalların (mail/otomasyon/panel/döküm PDF) ortak giriş noktası — cari başına TEK aktif link:
 *  1) aynı tutar son 3 günde tam ödendiyse → ödenen linki dön (yeni ödenebilir link YOK),
 *  2) açık (olusturuldu) aynı tutarlı link varsa → tekrar kullan (kanallar arası paylaşım),
 *  3) yoksa yeni üret.
 * Böylece aynı borç için birden çok canlı link doğmaz; biri ödenince kardeşleri callback iptal eder.
 */
export async function getOrCreateOdemeLinkForCari(opts: {
  cariKod: string
  firmaAdi: string | null
  cariEmail: string | null
  amountKurus: number
  userId?: string | null
}): Promise<{ kisaLink: string; qr: string | null; paytrUrl: string | null } | null> {
  try {
    if (!paytrYapili() || !(opts.amountKurus > 0)) return null
    const admin = createAdminClient()

    const paid = await recentPaidLinkUrl(opts.cariKod, opts.amountKurus)
    if (paid) return { kisaLink: paid, qr: null, paytrUrl: null }

    const enEski = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await admin
      .from('odeme_linkleri')
      .select('token,paytr_url')
      .eq('cari_kod', opts.cariKod)
      .eq('durum', 'olusturuldu')
      .eq('tutar_kurus', opts.amountKurus)
      .gte('created_at', enEski)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.token) {
      return {
        kisaLink: shortLinkUrl(String(data.token)),
        qr: null,
        paytrUrl: data.paytr_url ? String(data.paytr_url) : null,
      }
    }
    const yeni = await olusturVeKaydetOdemeLink(opts)
    return yeni ? { kisaLink: yeni.kisaLink, qr: yeni.qr, paytrUrl: yeni.paytrUrl } : null
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
}): Promise<{ bulundu: boolean; zatenIslendi: boolean; durum: string }> {
  const admin = createAdminClient()
  const { data: mevcut } = await admin
    .from('odeme_linkleri')
    .select('id,durum,cari_kod,tutar_kurus')
    .eq('token', params.callbackId)
    .maybeSingle()
  if (!mevcut) return { bulundu: false, zatenIslendi: false, durum: '' }
  if (mevcut.durum === 'odendi') return { bulundu: true, zatenIslendi: true, durum: 'odendi' }

  // Tutar kıyası: PayTR'nin fiilen tahsil ettiği (total_amount) hedeften AZSA "kısmi" — "tam ödendi"
  // sayma (aksi halde 1 TL kısmi ödeme borcu kapatmış gibi görünür, cari haksız yere susturulur).
  const tam =
    params.basarili &&
    params.totalAmountKurus != null &&
    mevcut.tutar_kurus != null &&
    params.totalAmountKurus >= Number(mevcut.tutar_kurus)
  const yeniDurum = params.basarili ? (tam ? 'odendi' : 'kismi') : 'basarisiz'

  const { error } = await admin
    .from('odeme_linkleri')
    .update({
      merchant_oid: params.merchantOid,
      durum: yeniDurum,
      odenen_kurus: params.totalAmountKurus,
      odendi_at: tam ? new Date().toISOString() : null,
      callback_ham: params.raw,
    })
    .eq('token', params.callbackId)
    .neq('durum', 'odendi')
  if (error) throw new Error(error.message) // route 500 döner → PayTR retry eder (callback kaybolmaz)

  // TAM ödemede: aynı cariye ait diğer AÇIK linkleri iptal et (çift tahsilat kapısını kapat).
  // Müşteriler yalnız /o/<token> kısa linkini alır; iptal edilen link orada "iptal edildi" gösterir.
  if (tam && mevcut.cari_kod) {
    await admin
      .from('odeme_linkleri')
      .update({ durum: 'iptal' })
      .eq('cari_kod', mevcut.cari_kod)
      .eq('durum', 'olusturuldu')
      .neq('token', params.callbackId)
  }
  return { bulundu: true, zatenIslendi: false, durum: yeniDurum }
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
