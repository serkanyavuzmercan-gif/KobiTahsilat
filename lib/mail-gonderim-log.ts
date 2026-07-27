import 'server-only'
import { createAdminClient } from './supabase/admin'

export type MailGonderimLogRow = {
  mail_to: string
  subject: string
  body_preview: string
  kaynak: string
  ilgili_id: string
  ilgili_tip: string
  sent_at?: string
  mail_from?: string | null
  gonderen_user_id?: string | null
}

export type MailGonderimLogResult = {
  ok: boolean
  error?: string
}

/** Supabase şemasında `gonderen_user_id` henüz yoksa otomatik düşürür. */
export async function insertMailGonderimLog(row: MailGonderimLogRow): Promise<MailGonderimLogResult> {
  const admin = createAdminClient()
  const payload: Record<string, unknown> = {
    mail_to: row.mail_to,
    subject: row.subject,
    body_preview: row.body_preview,
    kaynak: row.kaynak,
    ilgili_id: row.ilgili_id,
    ilgili_tip: row.ilgili_tip,
    sent_at: row.sent_at || new Date().toISOString(),
  }
  if (row.mail_from) payload.mail_from = row.mail_from
  if (row.gonderen_user_id) payload.gonderen_user_id = row.gonderen_user_id

  // Şemada opsiyonel kolonlar (mail_from / gonderen_user_id) bulunmayabilir. Insert bu yüzden
  // patlarsa, hataya konu olan opsiyonel kolonu düşürüp tekrar dene — böylece log ASLA sessizce
  // kaybolmaz. (mail_from kolonu yokken 133 mutabakat gönderimi loglanmamıştı; bu onu önler.)
  const opsiyonel = ['mail_from', 'gonderen_user_id']
  let { error } = await admin.from('mail_gonderim_log').insert(payload)
  for (let i = 0; i < opsiyonel.length && error; i++) {
    const eksik = opsiyonel.find((c) => c in payload && new RegExp(c, 'i').test(error!.message))
    if (!eksik) break
    delete payload[eksik]
    ;({ error } = await admin.from('mail_gonderim_log').insert(payload))
  }

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
