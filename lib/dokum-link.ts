import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from './supabase/admin'

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(/\/$/, '')
}

/** Kısa döküm linki (/d/<code>) → ödeme talebi PDF. WhatsApp'taki uzun token URL'sini kısaltır. */
export function dokumShortUrl(code: string): string {
  return `${appBase()}/d/${code}`
}

/**
 * Cari + snapshot için kısa döküm kodu üretir (son 7 günde aynısı varsa tekrar kullanır).
 * Hata olursa null → çağıran uzun PDF URL'sine düşebilir.
 */
export async function getOrCreateDokumShortLink(
  cariKod: string,
  snapshotTarihi: string
): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const enEski = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data } = await admin
      .from('dokum_linkleri')
      .select('code')
      .eq('cari_kod', cariKod)
      .eq('snapshot_tarihi', snapshotTarihi)
      .gte('created_at', enEski)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.code) return dokumShortUrl(String(data.code))

    const code = crypto.randomBytes(6).toString('base64url') // ~8 karakter
    const { error } = await admin
      .from('dokum_linkleri')
      .insert({ code, cari_kod: cariKod, snapshot_tarihi: snapshotTarihi })
    if (error) return null
    return dokumShortUrl(code)
  } catch {
    return null
  }
}

export async function resolveDokumCode(
  code: string
): Promise<{ cariKod: string; snapshotTarihi: string } | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('dokum_linkleri')
      .select('cari_kod,snapshot_tarihi')
      .eq('code', code)
      .maybeSingle()
    if (!data) return null
    return { cariKod: String(data.cari_kod), snapshotTarihi: String(data.snapshot_tarihi) }
  } catch {
    return null
  }
}
