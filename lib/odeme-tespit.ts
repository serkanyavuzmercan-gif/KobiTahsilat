import 'server-only'
import { createAdminClient } from './supabase/admin'

export type OdemeBilgi = {
  /** Son N günde EVRAK BAZINDA tespit edilen ödeme (kapanan + kısmi azalan). */
  odenen: number
  guncelAcik: number
  guncelGecikmis: number
}

/**
 * Son N günde ödeme yapan carileri döndürür.
 *
 * Neden evrak bazında? Toplam bakiye farkı yanıltıcıdır: müşteri 50.000 ₺ öderken 30.000 ₺'lik
 * yeni fatura girerse net düşüş 20.000 ₺ görünür, ödeme küçük sanılır. RPC her evrakın azalışını
 * ayrı toplar (bkz. cari_odeme_tespit_toplu).
 */
export async function sonOdemeler(gun = 7): Promise<Map<string, OdemeBilgi>> {
  const harita = new Map<string, OdemeBilgi>()
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('cari_odeme_tespit_toplu', { p_gun: gun })
    if (error) return harita
    for (const row of (data || []) as Array<Record<string, unknown>>) {
      const kod = String(row.cari_kod || '')
      if (!kod) continue
      harita.set(kod, {
        odenen: Number(row.odenen || 0),
        guncelAcik: Number(row.guncel_acik || 0),
        guncelGecikmis: Number(row.guncel_gecikmis || 0),
      })
    }
  } catch {
    /* ödeme tespiti başarısızsa gönderim akışı bozulmasın */
  }
  return harita
}

export async function cariSonOdeme(cariKod: string, gun = 7): Promise<OdemeBilgi | null> {
  const harita = await sonOdemeler(gun)
  return harita.get(cariKod) || null
}

/**
 * Ödeme "anlamlı" mı? Gecikmiş borcun ODEME_ESIK_YUZDE'sinden fazlaysa hatırlatma ertelenir.
 * 1.000.000 ₺ borca 10.000 ₺ ödeyene susmamak için oransal bakılır (kullanıcı kararı).
 */
export const ODEME_ESIK_YUZDE = 25

export function odemeAnlamliMi(odenen: number, gecikmis: number): boolean {
  if (odenen <= 0) return false
  if (gecikmis <= 0) return true
  return (odenen / gecikmis) * 100 >= ODEME_ESIK_YUZDE
}
