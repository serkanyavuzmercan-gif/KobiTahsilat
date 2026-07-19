import 'server-only'
import { buildHatirlatmaMessage } from '../hatirlatma'
import { loadSnapshot } from '../data'
import type { CariBakiye } from '../types'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** WhatsApp *kalın* işaretlerini basit HTML vurgusuna çevirir. */
function whatsappBoldToHtml(text: string) {
  return escapeHtml(text).replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
}

export function buildHatirlatmaEmail(
  cari: CariBakiye,
  snapshotTarihi: string,
  /** Kullanıcı önizlemede düzenlediyse gönderilecek gövde; boşsa varsayılan üretilir. */
  overrideBody?: string,
  /** Varsa "Ödeme yapmak için tıklayın" düğmesi eklenir (kendi kısa PayTR linkimiz). */
  odemeUrl?: string | null
) {
  const message = buildHatirlatmaMessage(cari, snapshotTarihi)
  const body = overrideBody && overrideBody.trim() ? overrideBody.trim() : message.body
  const htmlBody = whatsappBoldToHtml(body).replace(/\n/g, '<br />')

  const odemeButonHtml = odemeUrl
    ? `<div style="margin-top:22px">
<a href="${odemeUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:9px;font-weight:700;font-size:15px">Ödeme yapmak için tıklayın</a>
<p style="color:#64748b;font-size:12px;margin:8px 0 0">Güvenli ödeme sayfası (PayTR). Kart bilgileriniz bizimle paylaşılmaz.</p>
</div>`
    : ''
  const odemeButonText = odemeUrl ? `\n\nÖdeme yapmak için: ${odemeUrl}` : ''

  return {
    subject: `Ödeme hatırlatması — ${cari.firma_adi.trim()}`,
    text: `${body}${odemeButonText}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b">${htmlBody}${odemeButonHtml}</div>`,
    ozet: message.ozet,
  }
}

export async function loadAutomationSnapshotContext() {
  const snapshot = await loadSnapshot()
  return {
    snapshot,
    snapshotTarihi: snapshot.snapshot_tarihi,
  }
}
