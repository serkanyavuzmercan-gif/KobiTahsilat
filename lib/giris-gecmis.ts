import 'server-only'
import { createAdminClient } from './supabase/admin'

export type GirisKaydi = {
  id: number
  kullanici: string | null
  ip: string | null
  basarili: boolean
  created_at: string
  /** MFA kod doğrulaması mı, şifre girişi mi? */
  tur: 'sifre' | 'kod'
}

function esle(row: Record<string, unknown>): GirisKaydi {
  const kullanici = row.kullanici == null ? null : String(row.kullanici)
  const kod = Boolean(kullanici?.startsWith('mfa:'))
  return {
    id: Number(row.id),
    kullanici: kod ? null : kullanici,
    ip: row.ip == null ? null : String(row.ip),
    basarili: Boolean(row.basarili),
    created_at: String(row.created_at),
    tur: kod ? 'kod' : 'sifre',
  }
}

/** Kullanıcının kendi giriş geçmişi (şifre girişleri + MFA kod doğrulamaları). */
export async function kendiGirisGecmisi(
  email: string,
  userId: string,
  limit = 25
): Promise<GirisKaydi[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('giris_denemeleri')
      .select('id,kullanici,ip,basarili,created_at')
      .or(`kullanici.eq.${email.toLowerCase()},kullanici.eq.mfa:${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data || []).map(esle)
  } catch {
    return []
  }
}

/** Sistem genelindeki son BAŞARISIZ denemeler (saldırı izleme). */
export async function basarisizDenemeler(limit = 25): Promise<GirisKaydi[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('giris_denemeleri')
      .select('id,kullanici,ip,basarili,created_at')
      .eq('basarili', false)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data || []).map(esle)
  } catch {
    return []
  }
}
