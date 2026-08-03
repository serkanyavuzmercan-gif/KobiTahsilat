import 'server-only'
import { createAdminClient } from './supabase/admin'

/**
 * Login brute-force koruması (sunucu tarafı — tarayıcıdan temizlenemez).
 *
 * Kurallar:
 *  - Aynı KULLANICI için 15 dk içinde 5 başarısız deneme → 15 dk kilit.
 *  - Aynı IP için 15 dk içinde 15 başarısız deneme → 15 dk kilit (kullanıcı taraması).
 * Başarılı girişte o kullanıcının sayacı sıfırlanır.
 *
 * NOT: Bu katman login FORMUNU korur. Supabase auth uç noktası anon anahtarla dışarıdan
 * doğrudan da çağrılabildiği için ASIL zorunlu koruma Supabase Dashboard'daki CAPTCHA +
 * auth rate limit ayarlarıdır (docs/GUVENLIK-LOGIN.md).
 */

const PENCERE_DK = 15
const KULLANICI_LIMIT = 5
const IP_LIMIT = 15

export type GirisKontrolSonuc = {
  bloke: boolean
  kalanSaniye: number
  sebep?: 'kullanici' | 'ip'
  /** Son pencerede bu kullanıcı/IP için başarısız deneme sayısı (kademeli CAPTCHA için). */
  basarisizSayisi: number
}

function pencereBasi(): string {
  return new Date(Date.now() - PENCERE_DK * 60_000).toISOString()
}

export function istekIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') || 'bilinmeyen'
}

export function normalizeKullanici(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  return raw.includes('@') ? raw : `${raw}@hidroteknik.com.tr`
}

/** Bu kullanıcı/IP şu an kilitli mi? Hata durumunda ASLA kilitleme (girişi bloke etme). */
export async function girisKontrol(kullanici: string, ip: string): Promise<GirisKontrolSonuc> {
  try {
    const admin = createAdminClient()
    const since = pencereBasi()

    const { data, error } = await admin
      .from('giris_denemeleri')
      .select('kullanici,ip,created_at')
      .eq('basarili', false)
      .gte('created_at', since)
      .or(`kullanici.eq.${kullanici},ip.eq.${ip}`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return { bloke: false, kalanSaniye: 0, basarisizSayisi: 0 }

    const rows = data || []
    const kullaniciDenemeleri = kullanici ? rows.filter((r) => r.kullanici === kullanici) : []
    const ipDenemeleri = rows.filter((r) => r.ip === ip)
    const basarisizSayisi = Math.max(kullaniciDenemeleri.length, ipDenemeleri.length)

    const kilit = (liste: typeof rows, limit: number, sebep: 'kullanici' | 'ip') => {
      if (liste.length < limit) return null
      // Limitin dolduğu andan itibaren PENCERE_DK kadar kilitli kal.
      const enEski = liste[limit - 1]
      const bitis = Date.parse(String(enEski!.created_at)) + PENCERE_DK * 60_000
      const kalan = Math.ceil((bitis - Date.now()) / 1000)
      return kalan > 0 ? { bloke: true as const, kalanSaniye: kalan, sebep, basarisizSayisi } : null
    }

    return (
      kilit(kullaniciDenemeleri, KULLANICI_LIMIT, 'kullanici') ||
      kilit(ipDenemeleri, IP_LIMIT, 'ip') || { bloke: false, kalanSaniye: 0, basarisizSayisi }
    )
  } catch {
    return { bloke: false, kalanSaniye: 0, basarisizSayisi: 0 }
  }
}

/** Deneme sonucunu kaydet. Başarılıysa kullanıcının başarısız sayacını temizler. */
export async function girisKaydet(kullanici: string, ip: string, basarili: boolean): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('giris_denemeleri').insert({ kullanici, ip, basarili })
    if (basarili && kullanici) {
      await admin
        .from('giris_denemeleri')
        .delete()
        .eq('kullanici', kullanici)
        .eq('basarili', false)
    }
  } catch {
    // Loglama girişi engellemesin.
  }
}
