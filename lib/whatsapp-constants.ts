/** WhatsApp gönderen — ss ile ortak Baileys ofis botu hattı (Meta değil). */
export const WHATSAPP_SENDER_LABEL = 'Hidroteknik WhatsApp (ofis botu)'

/** SS iş hattı — müşteriyi sohbet başlatmaya yönlendirmek için */
export function ssWhatsAppBusinessLink(prefill?: string) {
  const base = 'https://wa.me/902582514060'
  if (!prefill?.trim()) return base
  return `${base}?text=${encodeURIComponent(prefill.trim())}`
}
