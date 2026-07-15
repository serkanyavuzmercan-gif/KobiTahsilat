import 'server-only'
import { loadSnapshot } from './data'
import {
  CARI_EMAIL_YANIT_TIP,
  CARI_WHATSAPP_YANIT_TIP,
  CARI_YANIT_LOG_KAYNAK,
} from './cari-yanit-log'
import { formatPhoneDisplay, formatPhoneWhatsApp, normalizePhone, parsePhones } from './phone'
import { createAdminClient } from './supabase/admin'
import type { CariYanitKayit, CariYanitOzet } from './types'

export type { CariYanitKayit, CariYanitOzet } from './types'

function emptyOzet(): CariYanitOzet {
  return { email: [], whatsapp: [], son_email: null, son_whatsapp: null }
}

function parseYanitBody(bodyPreview: string | null, subject: string | null) {
  if (!bodyPreview) return { ozet: subject || '', detay: subject || '' }
  try {
    const parsed = JSON.parse(bodyPreview) as { aciklama?: string; iletisim?: string; mesaj?: string }
    if (parsed.aciklama) {
      return {
        ozet: parsed.aciklama.slice(0, 120),
        detay: parsed.aciklama,
        gonderen: parsed.iletisim || null,
      }
    }
    if (parsed.mesaj) {
      return {
        ozet: parsed.mesaj.slice(0, 120),
        detay: parsed.mesaj,
        gonderen: null,
      }
    }
  } catch {
    // plain text fallback
  }
  const text = String(bodyPreview)
  return { ozet: text.slice(0, 120), detay: text, gonderen: null }
}

function rowToYanit(
  row: {
    sent_at: string | null
    mail_to: string | null
    subject: string | null
    body_preview: string | null
    ilgili_tip: string
  },
  kanal: 'email' | 'whatsapp'
): CariYanitKayit {
  const parsed = parseYanitBody(row.body_preview, row.subject)
  return {
    id: `${kanal}-${row.sent_at}-${row.mail_to || ''}`,
    kanal,
    tarih: String(row.sent_at || new Date().toISOString()),
    gonderen: parsed.gonderen || row.mail_to || null,
    ozet: parsed.ozet,
    detay: parsed.detay,
  }
}

export async function loadCariYanitlari(
  cariKodlari: string[]
): Promise<Record<string, CariYanitOzet>> {
  const result: Record<string, CariYanitOzet> = {}
  for (const kod of cariKodlari) result[kod] = emptyOzet()
  if (!cariKodlari.length) return result

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('ilgili_id,ilgili_tip,mail_to,subject,body_preview,sent_at')
    .in('ilgili_tip', [CARI_EMAIL_YANIT_TIP, CARI_WHATSAPP_YANIT_TIP])
    .in('ilgili_id', cariKodlari)
    .order('sent_at', { ascending: false })

  if (error) throw error

  for (const row of data || []) {
    const kod = String(row.ilgili_id || '')
    if (!kod || !result[kod]) continue
    const kanal = row.ilgili_tip === CARI_WHATSAPP_YANIT_TIP ? 'whatsapp' : 'email'
    const kayit = rowToYanit(row, kanal)
    result[kod][kanal].push(kayit)
  }

  for (const kod of cariKodlari) {
    result[kod].son_email = result[kod].email[0] || null
    result[kod].son_whatsapp = result[kod].whatsapp[0] || null
  }

  return result
}

export async function logEmailYanit(options: {
  cariKod: string
  aciklama: string
  iletisim?: string | null
  konu?: string
}) {
  const admin = createAdminClient()
  const sentAt = new Date().toISOString()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: options.cariKod,
    ilgili_tip: CARI_EMAIL_YANIT_TIP,
    mail_to: options.iletisim || '',
    subject: options.konu || 'Mutabakat fark/itiraz',
    body_preview: JSON.stringify({
      aciklama: options.aciklama,
      iletisim: options.iletisim || null,
    }),
    kaynak: CARI_YANIT_LOG_KAYNAK,
    sent_at: sentAt,
  })
  if (error) console.error('[cari-email-yanit-log]', error.message)
}

export async function logWhatsAppYanit(options: {
  cariKod: string
  telefon: string
  mesaj: string
}) {
  const admin = createAdminClient()
  const sentAt = new Date().toISOString()
  const display = formatPhoneDisplay(options.telefon)
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: options.cariKod,
    ilgili_tip: CARI_WHATSAPP_YANIT_TIP,
    mail_to: options.telefon,
    subject: `WhatsApp yanıt · ${display}`,
    body_preview: JSON.stringify({ mesaj: options.mesaj }),
    kaynak: CARI_YANIT_LOG_KAYNAK,
    sent_at: sentAt,
  })
  if (error) console.error('[cari-whatsapp-yanit-log]', error.message)
}

export async function buildPhoneToCariMap() {
  const snapshot = loadSnapshot()
  const admin = createAdminClient()
  const codes = snapshot.cariler.map((c) => c.cari_kod)
  const { data } = await admin.from('cariler').select('cari_kod,telefon').in('cari_kod', codes)

  const masterPhone = new Map(
    (data || []).map((row) => [String(row.cari_kod), parsePhones(row.telefon)])
  )

  const phoneToCari = new Map<string, string>()

  for (const cari of snapshot.cariler) {
    const phones = [
      ...(masterPhone.get(cari.cari_kod) || []),
      ...cari.telefon_numaralari,
      ...(cari.telefon ? [cari.telefon] : []),
    ]
    for (const phone of phones) {
      phoneToCari.set(formatPhoneWhatsApp(phone), cari.cari_kod)
    }
  }

  return phoneToCari
}

export async function findCariKodByWhatsAppPhone(from: string) {
  const normalized = normalizePhone(from.startsWith('+') ? from : `+${from.replace(/\D/g, '')}`)
  if (!normalized) return null
  const map = await buildPhoneToCariMap()
  return map.get(formatPhoneWhatsApp(normalized)) || null
}
