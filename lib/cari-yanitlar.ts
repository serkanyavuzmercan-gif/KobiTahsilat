import 'server-only'
import { loadSnapshot } from './data'
import {
  CARI_EMAIL_YANIT_TIP,
  CARI_MUTABAKAT_ONAY_TIP,
  CARI_WHATSAPP_YANIT_TIP,
  CARI_YANIT_LOG_KAYNAK,
  CARI_YANIT_OKUNDU_TIP,
} from './cari-yanit-log'
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

/** Müşterinin "Evet, mutabıkız" onayını kaydeder. */
export async function logMutabakatOnay(options: {
  cariKod: string
  aciklama?: string | null
  iletisim?: string | null
}) {
  const admin = createAdminClient()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: options.cariKod,
    ilgili_tip: CARI_MUTABAKAT_ONAY_TIP,
    mail_to: options.iletisim || '',
    subject: 'Mutabakat onayı',
    body_preview: JSON.stringify({
      aciklama: options.aciklama?.trim() || 'Bakiye onaylandı (mutabıkız).',
      iletisim: options.iletisim || null,
    }),
    kaynak: CARI_YANIT_LOG_KAYNAK,
    sent_at: new Date().toISOString(),
  })
  if (error) console.error('[mutabakat-onay-log]', error.message)
}

export type MutabakatSonuc = {
  id: string
  cari_kod: string
  firma_adi: string
  tip: 'onay' | 'itiraz'
  tarih: string
  aciklama: string
  iletisim: string | null
}

/** Mutabakat onay + itiraz yanıtlarını (Serkan bey'in tek tek göreceği) toplu döner. */
export async function loadMutabakatSonuclar(): Promise<MutabakatSonuc[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('ilgili_id,ilgili_tip,mail_to,subject,body_preview,sent_at')
    .in('ilgili_tip', [CARI_MUTABAKAT_ONAY_TIP, CARI_EMAIL_YANIT_TIP])
    .order('sent_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const firmaMap = await firmaAdiMap()

  return (data || []).map((row, index) => {
    const cariKod = String(row.ilgili_id || '')
    const parsed = parseYanitBody(row.body_preview, row.subject)
    const tarih = String(row.sent_at || '')
    return {
      id: `${row.ilgili_tip}-${tarih}-${cariKod}-${index}`,
      cari_kod: cariKod,
      firma_adi: firmaMap.get(cariKod) || cariKod,
      tip: row.ilgili_tip === CARI_MUTABAKAT_ONAY_TIP ? 'onay' : 'itiraz',
      tarih,
      aciklama: parsed.detay || parsed.ozet || '',
      iletisim: parsed.gonderen || (row.mail_to ? String(row.mail_to) : null),
    }
  })
}

