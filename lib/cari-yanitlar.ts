import 'server-only'
import { loadSnapshot } from './data'
import {
  CARI_EMAIL_YANIT_TIP,
  CARI_WHATSAPP_YANIT_TIP,
  CARI_YANIT_LOG_KAYNAK,
  CARI_YANIT_OKUNDU_TIP,
} from './cari-yanit-log'
import { formatPhoneDisplay, formatPhoneWhatsApp, normalizePhone, parsePhones } from './phone'
import { createAdminClient } from './supabase/admin'
import type { CariYanitKayit, CariYanitOzet } from './types'

export type { CariYanitKayit, CariYanitOzet } from './types'

function emptyOzet(): CariYanitOzet {
  return {
    email: [],
    whatsapp: [],
    son_email: null,
    son_whatsapp: null,
    okunmamis_email: 0,
    okunmamis_whatsapp: 0,
  }
}

async function firmaAdiMap() {
  const snapshot = await loadSnapshot()
  return new Map(snapshot.cariler.map((cari) => [cari.cari_kod, cari.firma_adi]))
}

function parseYanitBody(bodyPreview: string | null, subject: string | null) {
  if (!bodyPreview) return { ozet: subject || '', detay: subject || '', gonderen: null as string | null }
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

function buildYanitId(kanal: string, sentAt: string, mailTo: string) {
  return `${kanal}-${sentAt}-${mailTo}`
}

async function loadOkunanYanitIds(userId: string): Promise<Set<string>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('mail_to')
    .eq('ilgili_tip', CARI_YANIT_OKUNDU_TIP)
    .eq('ilgili_id', userId)

  if (error) throw error
  return new Set((data || []).map((row) => String(row.mail_to || '')).filter(Boolean))
}

function rowToYanit(
  row: {
    ilgili_id: string | null
    sent_at: string | null
    mail_to: string | null
    subject: string | null
    body_preview: string | null
    ilgili_tip: string
  },
  kanal: 'email' | 'whatsapp',
  firmaMap: Map<string, string>,
  okunan: Set<string>
): CariYanitKayit {
  const cariKod = String(row.ilgili_id || '')
  const parsed = parseYanitBody(row.body_preview, row.subject)
  const id = buildYanitId(kanal, String(row.sent_at || ''), String(row.mail_to || ''))
  return {
    id,
    cari_kod: cariKod,
    firma_adi: firmaMap.get(cariKod) || cariKod,
    kanal,
    tarih: String(row.sent_at || new Date().toISOString()),
    gonderen: parsed.gonderen || row.mail_to || null,
    ozet: parsed.ozet,
    detay: parsed.detay,
    okundu: okunan.has(id),
  }
}

function finalizeOzet(ozet: CariYanitOzet) {
  ozet.son_email = ozet.email[0] || null
  ozet.son_whatsapp = ozet.whatsapp[0] || null
  ozet.okunmamis_email = ozet.email.filter((item) => !item.okundu).length
  ozet.okunmamis_whatsapp = ozet.whatsapp.filter((item) => !item.okundu).length
}

export async function loadCariYanitlari(
  userId: string,
  cariKodlari: string[]
): Promise<Record<string, CariYanitOzet>> {
  const result: Record<string, CariYanitOzet> = {}
  for (const kod of cariKodlari) result[kod] = emptyOzet()
  if (!cariKodlari.length) return result

  const [okunan, firmaMap] = await Promise.all([loadOkunanYanitIds(userId), firmaAdiMap()])

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
    const kayit = rowToYanit(row, kanal, firmaMap, okunan)
    result[kod][kanal].push(kayit)
  }

  for (const kod of cariKodlari) finalizeOzet(result[kod])
  return result
}

export async function loadYanitInbox(userId: string): Promise<CariYanitKayit[]> {
  const snapshot = await loadSnapshot()
  const kodlar = snapshot.cariler.map((cari) => cari.cari_kod)
  const grouped = await loadCariYanitlari(userId, kodlar)
  return Object.values(grouped)
    .flatMap((ozet) => [...ozet.email, ...ozet.whatsapp])
    .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
}

export async function markYanitlarOkundu(userId: string, yanitIds: string[]) {
  const unique = [...new Set(yanitIds.filter(Boolean))]
  if (!unique.length) return

  const admin = createAdminClient()
  const sentAt = new Date().toISOString()
  const rows = unique.map((yanitId) => ({
    ilgili_id: userId,
    ilgili_tip: CARI_YANIT_OKUNDU_TIP,
    mail_to: yanitId,
    subject: 'Yanıt okundu',
    body_preview: yanitId,
    kaynak: CARI_YANIT_LOG_KAYNAK,
    sent_at: sentAt,
    gonderen_user_id: userId,
  }))

  const { error } = await admin.from('mail_gonderim_log').insert(rows)
  if (error) throw error
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
  const snapshot = await loadSnapshot()
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
