import 'server-only'
import { loadSnapshot } from './data'
import type { CariBakiye } from './types'
import { createAdminClient } from './supabase/admin'
import { addBusinessDays } from './business-days'

export type MutabakatCari = CariBakiye & {
  mutabakat_son_gonderim: string | null
  mutabakat_gonderim_sayisi: number
  mutabakat_tekrar_gonderilebilir_at: string | null
  mutabakat_gonderim_engelli: boolean
}

export async function loadMutabakatCariler(): Promise<MutabakatCari[]> {
  const snapshot = loadSnapshot()
  const admin = createAdminClient()
  const codes = snapshot.cariler.map((cari) => cari.cari_kod)

  const [{ data: masterRows, error: masterError }, { data: logRows, error: logError }] =
    await Promise.all([
      admin.from('cariler').select('cari_kod,email').in('cari_kod', codes),
      admin
        .from('mail_gonderim_log')
        .select('ilgili_id,ilgili_tip,mail_to,sent_at')
        .in('ilgili_tip', [
          'mutabakat',
          'mutabakat_email_override',
          'mutabakat_email_aday_reddet',
        ])
        .in('ilgili_id', codes)
        .order('sent_at', { ascending: false }),
    ])

  if (masterError) throw masterError
  if (logError) throw logError

  const masterEmail = new Map(
    (masterRows || []).map((row) => [String(row.cari_kod), parseEmails(row.email)])
  )
  const overrideEmail = new Map<string, string[]>()
  const sentHistory = new Map<string, string[]>()
  const dismissedCandidates = new Map<string, Set<string>>()

  for (const row of logRows || []) {
    const code = String(row.ilgili_id || '')
    if (!code) continue
    if (row.ilgili_tip === 'mutabakat_email_override' && !overrideEmail.has(code)) {
      overrideEmail.set(code, parseEmails(row.mail_to))
    }
    if (row.ilgili_tip === 'mutabakat' && row.sent_at) {
      const dates = sentHistory.get(code) || []
      dates.push(String(row.sent_at))
      sentHistory.set(code, dates)
    }
    if (row.ilgili_tip === 'mutabakat_email_aday_reddet') {
      const dismissed = dismissedCandidates.get(code) || new Set<string>()
      for (const email of parseEmails(row.mail_to)) dismissed.add(email)
      dismissedCandidates.set(code, dismissed)
    }
  }

  return snapshot.cariler.map((cari) => {
    const override = overrideEmail.get(cari.cari_kod)
    const master = masterEmail.get(cari.cari_kod) || []
    const effectiveEmails =
      override !== undefined ? override : master.length ? master : cari.email_adresleri
    const emailAddresses = effectiveEmails.length ? effectiveEmails : []
    const history = sentHistory.get(cari.cari_kod) || []
    const hiddenCandidates = dismissedCandidates.get(cari.cari_kod) || new Set<string>()
    const visibleCandidates = cari.email_adaylari.filter(
      (candidate) =>
        !emailAddresses.includes(candidate.email) && !hiddenCandidates.has(candidate.email)
    )
    const nextSendAt = history[0] ? addBusinessDays(history[0], 8).toISOString() : null
    const sendBlocked = nextSendAt ? new Date(nextSendAt).getTime() > Date.now() : false
    return {
      ...cari,
      email: emailAddresses[0] || null,
      email_adresleri: emailAddresses,
      email_kaynagi: overrideEmail.has(cari.cari_kod)
        ? 'Kullanıcı tarafından düzenlendi'
        : masterEmail.get(cari.cari_kod)?.length
          ? 'SS cari kartı'
          : cari.email_kaynagi,
      email_guven: emailAddresses.length ? 'dogrulanmis' : cari.email_guven,
      email_adaylari: visibleCandidates,
      mutabakat_son_gonderim: history[0] || null,
      mutabakat_gonderim_sayisi: history.length,
      mutabakat_tekrar_gonderilebilir_at: nextSendAt,
      mutabakat_gonderim_engelli: sendBlocked,
    }
  })
}

export async function loadMutabakatCari(cariKod: string): Promise<MutabakatCari | undefined> {
  return (await loadMutabakatCariler()).find((cari) => cari.cari_kod === cariKod)
}

export function parseEmails(value: unknown): string[] {
  return [
    ...new Set(
      String(value || '')
        .split(/[;,\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ),
  ]
}

