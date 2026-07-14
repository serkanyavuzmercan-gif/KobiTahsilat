import 'server-only'
import { loadSnapshot } from './data'
import { addBusinessDays } from './business-days'
import {
  HATIRLATMA_LOG_KAYNAK,
  WHATSAPP_PHONE_DISMISS_TIP,
  WHATSAPP_PHONE_OVERRIDE_TIP,
  WHATSAPP_SEND_TIP,
} from './hatirlatma-log'
import { parsePhones } from './phone'
import type { CariBakiye } from './types'
import { createAdminClient } from './supabase/admin'

export type HatirlatmaCari = CariBakiye & {
  whatsapp_son_gonderim: string | null
  whatsapp_gonderim_sayisi: number
  whatsapp_tekrar_gonderilebilir_at: string | null
  whatsapp_gonderim_engelli: boolean
}

const WHATSAPP_COOLDOWN_DAYS = 3

export async function loadHatirlatmaCariler(): Promise<HatirlatmaCari[]> {
  const snapshot = loadSnapshot()
  const admin = createAdminClient()
  const codes = snapshot.cariler.map((cari) => cari.cari_kod)

  const [{ data: masterRows, error: masterError }, { data: logRows, error: logError }] =
    await Promise.all([
      admin.from('cariler').select('cari_kod,telefon').in('cari_kod', codes),
      admin
        .from('mail_gonderim_log')
        .select('ilgili_id,ilgili_tip,mail_to,sent_at')
        .in('ilgili_tip', [
          WHATSAPP_SEND_TIP,
          WHATSAPP_PHONE_OVERRIDE_TIP,
          WHATSAPP_PHONE_DISMISS_TIP,
        ])
        .in('ilgili_id', codes)
        .order('sent_at', { ascending: false }),
    ])

  if (masterError) throw masterError
  if (logError) throw logError

  const masterPhone = new Map(
    (masterRows || []).map((row) => [String(row.cari_kod), parsePhones(row.telefon)])
  )
  const overridePhone = new Map<string, string[]>()
  const sentHistory = new Map<string, string[]>()
  const dismissedCandidates = new Map<string, Set<string>>()

  for (const row of logRows || []) {
    const code = String(row.ilgili_id || '')
    if (!code) continue
    if (row.ilgili_tip === WHATSAPP_PHONE_OVERRIDE_TIP && !overridePhone.has(code)) {
      overridePhone.set(code, parsePhones(row.mail_to))
    }
    if (row.ilgili_tip === WHATSAPP_SEND_TIP && row.sent_at) {
      const dates = sentHistory.get(code) || []
      dates.push(String(row.sent_at))
      sentHistory.set(code, dates)
    }
    if (row.ilgili_tip === WHATSAPP_PHONE_DISMISS_TIP) {
      const dismissed = dismissedCandidates.get(code) || new Set<string>()
      for (const phone of parsePhones(row.mail_to)) dismissed.add(phone)
      dismissedCandidates.set(code, dismissed)
    }
  }

  return snapshot.cariler.map((cari) => {
    const override = overridePhone.get(cari.cari_kod)
    const master = masterPhone.get(cari.cari_kod) || []
    const snapshotPhones = cari.telefon_numaralari?.length
      ? cari.telefon_numaralari
      : cari.telefon
        ? [cari.telefon]
        : []
    const effectivePhones =
      override !== undefined ? override : master.length ? master : snapshotPhones
    const phoneNumbers = effectivePhones.length ? effectivePhones : []
    const history = sentHistory.get(cari.cari_kod) || []
    const hiddenCandidates = dismissedCandidates.get(cari.cari_kod) || new Set<string>()
    const visibleCandidates = (cari.telefon_adaylari || []).filter(
      (candidate) =>
        !phoneNumbers.includes(candidate.telefon) && !hiddenCandidates.has(candidate.telefon)
    )
    const nextSendAt = history[0]
      ? addBusinessDays(history[0], WHATSAPP_COOLDOWN_DAYS).toISOString()
      : null
    const sendBlocked = nextSendAt ? new Date(nextSendAt).getTime() > Date.now() : false

    return {
      ...cari,
      telefon: phoneNumbers[0] || null,
      telefon_numaralari: phoneNumbers,
      telefon_kaynagi: overridePhone.has(cari.cari_kod)
        ? 'Kullanıcı tarafından düzenlendi'
        : masterPhone.get(cari.cari_kod)?.length
          ? 'SS cari kartı'
          : cari.telefon_kaynagi,
      telefon_guven: phoneNumbers.length ? 'dogrulanmis' : cari.telefon_guven,
      telefon_adaylari: visibleCandidates,
      whatsapp_son_gonderim: history[0] || null,
      whatsapp_gonderim_sayisi: history.length,
      whatsapp_tekrar_gonderilebilir_at: nextSendAt,
      whatsapp_gonderim_engelli: sendBlocked,
    }
  })
}

export async function loadHatirlatmaCari(cariKod: string): Promise<HatirlatmaCari | undefined> {
  return (await loadHatirlatmaCariler()).find((cari) => cari.cari_kod === cariKod)
}

export { HATIRLATMA_LOG_KAYNAK }
