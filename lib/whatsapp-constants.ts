/** WhatsApp iş hattı — Meta doğrulanmış gönderen. */
export const WHATSAPP_SENDER_LABEL = 'Hidroteknik (+90 258 251 40 60)'

/** SS iş hattı — müşteriyi sohbet başlatmaya yönlendirmek için */
export function ssWhatsAppBusinessLink(prefill?: string) {
  const base = 'https://wa.me/902582514060'
  if (!prefill?.trim()) return base
  return `${base}?text=${encodeURIComponent(prefill.trim())}`
}
