import 'server-only'
import { createAdminClient } from './supabase/admin'

export type CariKisi = {
  id: string
  ad_soyad: string
  unvan: string | null
  telefon: string | null
  email: string | null
}

/** Bir cariye tanımlı iletişim kişileri (cari_kisiler, cari_kod üzerinden). */
export async function loadCariKisiler(cariKod: string): Promise<CariKisi[]> {
  const admin = createAdminClient()
  const { data: cari } = await admin.from('cariler').select('id').eq('cari_kod', cariKod).maybeSingle()
  const cariId = cari?.id ? String(cari.id) : null
  if (!cariId) return []
  const { data, error } = await admin
    .from('cari_kisiler')
    .select('id,ad_soyad,unvan,telefon,email')
    .eq('cari_id', cariId)
    .order('ad_soyad', { ascending: true })
  if (error) throw error
  return (data || []).map((k) => ({
    id: String(k.id),
    ad_soyad: String(k.ad_soyad || ''),
    unvan: k.unvan ? String(k.unvan) : null,
    telefon: k.telefon ? String(k.telefon) : null,
    email: k.email ? String(k.email) : null,
  }))
}

/** Telefon/e-posta → açıklama (ad + rol) haritası; gönderim seçicilerinde etiket için. */
export async function loadIletisimEtiketleri(
  cariKodlari: string[]
): Promise<Record<string, { telefon: Record<string, string>; email: Record<string, string> }>> {
  const result: Record<string, { telefon: Record<string, string>; email: Record<string, string> }> = {}
  if (!cariKodlari.length) return result

  const admin = createAdminClient()
  // cari_kod -> id
  const idToKod = new Map<string, string>()
  for (let i = 0; i < cariKodlari.length; i += 200) {
    const { data } = await admin
      .from('cariler')
      .select('id,cari_kod')
      .in('cari_kod', cariKodlari.slice(i, i + 200))
    for (const c of data || []) idToKod.set(String(c.id), String(c.cari_kod))
  }
  const ids = [...idToKod.keys()]
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from('cari_kisiler')
      .select('cari_id,ad_soyad,unvan,telefon,email')
      .in('cari_id', ids.slice(i, i + 200))
    for (const k of data || []) {
      const kod = idToKod.get(String(k.cari_id))
      if (!kod) continue
      const bucket = (result[kod] ||= { telefon: {}, email: {} })
      const etiket = [String(k.ad_soyad || '').trim(), String(k.unvan || '').trim()]
        .filter(Boolean)
        .join(' · ')
      if (!etiket) continue
      const tel = String(k.telefon || '').replace(/[^\d+]/g, '')
      if (tel && !bucket.telefon[tel]) bucket.telefon[tel] = etiket
      const mail = String(k.email || '').trim().toLowerCase()
      if (mail && !bucket.email[mail]) bucket.email[mail] = etiket
    }
  }
  return result
}
