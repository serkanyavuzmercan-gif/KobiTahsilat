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

export function buildHatirlatmaEmail(cari: CariBakiye, snapshotTarihi: string) {
  const message = buildHatirlatmaMessage(cari, snapshotTarihi)
  const htmlBody = whatsappBoldToHtml(message.body).replace(/\n/g, '<br />')

  return {
    subject: `Ödeme hatırlatması — ${cari.firma_adi.trim()}`,
    text: message.body,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b">${htmlBody}</div>`,
    ozet: message.ozet,
  }
}

export function loadAutomationSnapshotContext() {
  const snapshot = loadSnapshot()
  return {
    snapshot,
    snapshotTarihi: snapshot.snapshot_tarihi,
  }
}
