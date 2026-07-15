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

  let { error } = await admin.from('mail_gonderim_log').insert(payload)
  if (
    error &&
    row.gonderen_user_id &&
    /gonderen_user_id/i.test(error.message)
  ) {
    delete payload.gonderen_user_id
    ;({ error } = await admin.from('mail_gonderim_log').insert(payload))
  }

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
