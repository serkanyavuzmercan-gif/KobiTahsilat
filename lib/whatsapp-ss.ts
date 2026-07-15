import 'server-only'

/**
 * SS (/yonetim/sohbet) ile aynı WhatsApp oturum modeli.
 * Müşteri tawkto widget'ından yazınca oturum `wa_<905...>` olarak Supabase'de açılır;
 * SS yalnızca bu oturumlara serbest metin yanıt verir (waMetinGonder).
 */

import { formatPhoneWhatsApp } from './phone'
import { createAdminClient } from './supabase/admin'

const WINDOW_MS = 24 * 60 * 60 * 1000

export function ssWhatsAppOturumId(phone: string) {
  return `wa_${formatPhoneWhatsApp(phone)}`
}

export function ssWhatsAppOturumMu(oturum: string) {
  return typeof oturum === 'string' && oturum.startsWith('wa_')
}

export function ssWhatsAppTelefon(oturum: string) {
  return ssWhatsAppOturumMu(oturum) ? oturum.slice(3) : ''
}

export type SsWhatsAppSessionInfo = {
  oturumId: string
  oturumVar: boolean
  sonMusteriMesaji: string | null
  pencereAcik: boolean
}

export async function loadSsWhatsAppSession(
  phone: string,
  now = new Date()
): Promise<SsWhatsAppSessionInfo> {
  const admin = createAdminClient()
  const oturumId = ssWhatsAppOturumId(phone)
  const since = new Date(now.getTime() - WINDOW_MS).toISOString()

  const [{ data: oturum }, { data: sonMesajlar, error: mesajError }] = await Promise.all([
    admin.from('chat_oturum').select('updated_at,son_mesaj').eq('id', oturumId).maybeSingle(),
    admin
      .from('chat_mesaj')
      .select('created_at')
      .eq('oturum_id', oturumId)
      .eq('rol', 'user')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  if (mesajError) {
    console.warn('[whatsapp-ss] chat_mesaj sorgusu başarısız:', mesajError.message)
  }

  const sonMusteri = sonMesajlar?.[0]

  return {
    oturumId,
    oturumVar: Boolean(oturum),
    sonMusteriMesaji: oturum?.son_mesaj || null,
    pencereAcik: Boolean(sonMusteri?.created_at),
  }
}

/** SS iş hattı — müşteriyi sohbet başlatmaya yönlendirmek için (client-safe) */
export function ssWhatsAppBusinessLink(prefill?: string) {
  const base = 'https://wa.me/902582514060'
  if (!prefill?.trim()) return base
  return `${base}?text=${encodeURIComponent(prefill.trim())}`
}
