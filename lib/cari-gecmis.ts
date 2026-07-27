import 'server-only'
import { createAdminClient } from './supabase/admin'

/**
 * Bir cariye ait gönderim geçmişi + müşteri yanıtları — hepsi mail_gonderim_log'da
 * (ilgili_id = cari_kod). Cari detay sayfasında zaman çizelgesi olarak gösterilir.
 */

const GIDEN: Record<string, { baslik: string; kanal: string }> = {
  mutabakat: { baslik: 'Mutabakat gönderildi', kanal: 'E-posta' },
  tahsilat_odeme_talep_email: { baslik: 'Ödeme talebi gönderildi', kanal: 'E-posta' },
  tahsilat_whatsapp: { baslik: 'Ödeme talebi gönderildi', kanal: 'WhatsApp' },
}

const YANIT: Record<string, { baslik: string; kanal: string }> = {
  tahsilat_mutabakat_onay: { baslik: 'Mutabakat ONAYLANDI (mutabıkız)', kanal: '' },
  tahsilat_email_yanit: { baslik: 'Müşteri yanıtı / itiraz', kanal: 'E-posta' },
  tahsilat_whatsapp_yanit: { baslik: 'Müşteri yanıtı', kanal: 'WhatsApp' },
}

export type CariGecmisKayit = {
  id: string
  tarih: string
  yon: 'giden' | 'yanit'
  onay: boolean
  baslik: string
  kanal: string
  /** Giden: alıcılar. Yanıt: müşterinin bıraktığı iletişim (varsa). */
  kisi: string | null
  /** Yanıt içeriği (açıklama) veya giden konu. */
  metin: string | null
}

/** body_preview JSON ise açıklamayı çıkarır; değilse ham metni döndürür. */
function metniCoz(subject: string | null, bodyPreview: string | null, yanit: boolean): string | null {
  if (yanit && bodyPreview) {
    try {
      const parsed = JSON.parse(bodyPreview) as { aciklama?: string }
      if (parsed?.aciklama) return String(parsed.aciklama)
    } catch {
      /* JSON değil, ham göster */
    }
    return bodyPreview
  }
  return subject || null
}

export async function loadCariGecmis(cariKod: string): Promise<CariGecmisKayit[]> {
  const admin = createAdminClient()
  const tips = [...Object.keys(GIDEN), ...Object.keys(YANIT)]
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('id,ilgili_tip,mail_to,subject,body_preview,sent_at,created_at')
    .eq('ilgili_id', cariKod)
    .in('ilgili_tip', tips)
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) throw error

  return (data || []).map((r) => {
    const tip = String(r.ilgili_tip)
    const giden = GIDEN[tip]
    const meta = giden || YANIT[tip]
    const yanit = !giden
    return {
      id: String(r.id),
      tarih: String(r.sent_at || r.created_at || ''),
      yon: yanit ? 'yanit' : 'giden',
      onay: tip === 'tahsilat_mutabakat_onay',
      baslik: meta?.baslik || tip,
      kanal: meta?.kanal || '',
      kisi: r.mail_to ? String(r.mail_to) : null,
      metin: metniCoz(
        r.subject ? String(r.subject) : null,
        r.body_preview ? String(r.body_preview) : null,
        yanit
      ),
    }
  })
}
