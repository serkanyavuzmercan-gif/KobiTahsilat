import 'server-only'
import { createAdminClient } from './supabase/admin'
import { MUTABAKAT_TIPS, ODEME_TALEP_TIPS } from './automation/dedup'
import { cariSonOdeme } from './odeme-tespit'
import { formatTL } from './types'

/**
 * TAHSİLAT BASKISI ÖLÇER — "yükseltmeye insan onayı" kuralı (kullanıcı kararı 2026-08).
 *
 * Gerekçe (HİDROBARSAN olayı): müşteri 50.000 ₺ ödedi; aynı gün hatırlatma, ertesi gün İKİ ayrı
 * numaraya WhatsApp, ardından iki telefon araması gitti. Tek tek her adım savunulabilirdi;
 * TOPLAMI kırıcıydı ve kimse toplamı görmüyordu. Bu modül toplamı görünür kılar ve ikinci
 * dokunuşu sessiz olmaktan çıkarıp AÇIK ONAYA bağlar.
 *
 * Otomasyon zaten 8 iş günü kuralıyla korunuyor; asıl boşluk MANUEL gönderimdeydi (olay da
 * manuel gönderimle yaşandı), bu yüzden kapı manuel uçlarda da uygulanır.
 */

/** Bu pencerede ikinci bir evrak "yükseltme" sayılır. */
export const BASKI_PENCERE_GUN = 7

export type BaskiDurumu = {
  /** Son BASKI_PENCERE_GUN içindeki gönderim sayısı (manuel + otomatik, tüm tipler). */
  gonderimSayisi: number
  sonGonderim: string | null
  /** Yeni bir gönderim yükseltme sayılır mı → açık onay gerekir. */
  yukseltme: boolean
  /** Son günlerde tespit edilen ödeme (TL, 0 = yok). */
  sonOdeme: number
  /** Kullanıcıya gösterilecek tek cümlelik gerekçe (yukseltme false ise null). */
  uyari: string | null
}

const TUM_TIPLER = [...MUTABAKAT_TIPS, ...ODEME_TALEP_TIPS]

export async function baskiDurumu(
  cariKod: string,
  gun = BASKI_PENCERE_GUN
): Promise<BaskiDurumu> {
  const since = new Date(Date.now() - gun * 86400000).toISOString()
  let gonderimSayisi = 0
  let sonGonderim: string | null = null

  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('mail_gonderim_log')
      .select('sent_at')
      .eq('ilgili_id', cariKod)
      .in('ilgili_tip', TUM_TIPLER)
      .gte('sent_at', since)
      .order('sent_at', { ascending: false })
    gonderimSayisi = (data || []).length
    sonGonderim = data?.[0]?.sent_at ? String(data[0].sent_at) : null
  } catch {
    /* ölçüm başarısızsa gönderimi bloklamayalım — kapı fail-open */
  }

  const sonOdeme = (await cariSonOdeme(cariKod))?.odenen || 0
  const yukseltme = gonderimSayisi > 0

  let uyari: string | null = null
  if (yukseltme) {
    const ne = sonGonderim ? new Date(sonGonderim).toLocaleString('tr-TR') : 'yakın zamanda'
    uyari =
      `Bu firmaya son ${gun} günde ${gonderimSayisi} evrak gönderildi (en son: ${ne}). ` +
      (sonOdeme > 0
        ? `Ayrıca ${formatTL(sonOdeme)} ödeme yaptılar. `
        : '') +
      'Yeni gönderim bir YÜKSELTMEDİR — göndermeden önce onaylayın.'
  }

  return { gonderimSayisi, sonGonderim, yukseltme, sonOdeme, uyari }
}

/**
 * Manuel gönderim uçlarında kapı. `onay` gelmedikçe yükseltme gönderimi REDDEDİLİR.
 * Dönen değer null ise gönderime devam edilebilir; değilse route bunu 409 ile döndürmelidir.
 */
export async function yukseltmeKapisi(
  cariKod: string,
  onay: boolean
): Promise<{ durum: BaskiDurumu; engel: string | null }> {
  const durum = await baskiDurumu(cariKod)
  if (durum.yukseltme && !onay) return { durum, engel: durum.uyari }
  return { durum, engel: null }
}
