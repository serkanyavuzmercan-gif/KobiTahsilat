import 'server-only'
import { createDefaultAutomationSettings } from './defaults'
import type { AutomationSettings, Frekans, OdemeTalepKanal } from './types'
import { AUTOMATION_LOG_KAYNAK, AUTOMATION_SETTINGS_TIP } from '../automation-log'
import { createAdminClient } from '../supabase/admin'

function num(value: unknown, def: number, min = 0, max = 1_000_000_000): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return def
  return Math.min(max, Math.max(min, n))
}

function saat(value: unknown, def: string): string {
  return /^\d{2}:\d{2}$/.test(String(value || '')) ? String(value) : def
}

function parseFrekans(value: unknown, def: Frekans): Frekans {
  const raw = (value as Record<string, unknown>) || {}
  const tur = (['gunluk', 'haftalik', 'aylik'].includes(String(raw.tur))
    ? String(raw.tur)
    : def.tur) as Frekans['tur']
  let gun = num(raw.gun, def.gun, 1, 31)
  if (tur === 'haftalik') gun = Math.min(7, Math.max(1, gun))
  else if (tur === 'aylik') gun = Math.min(28, Math.max(1, gun))
  return { tur, gun }
}

/**
 * Ayarları v2 modele normalize eder. Eski v1 ayarları (tek otomasyon_aktif + kanal-kurallar)
 * otomatik olarak Ödeme Talebi bloğuna göç ettirilir (kayıp yok); Mutabakat bloğu kapalı başlar.
 */
function parseSettings(value: unknown): AutomationSettings {
  const d = createDefaultAutomationSettings()
  if (!value || typeof value !== 'object') return d
  const raw = value as Record<string, unknown>

  // v2 (mutabakat/odeme_talebi blokları var)
  if (raw.version === 2 || (raw.mutabakat && typeof raw.mutabakat === 'object')) {
    const m = (raw.mutabakat as Record<string, unknown>) || {}
    const o = (raw.odeme_talebi as Record<string, unknown>) || {}
    const kanal = String(o.kanal || '')
    return {
      version: 2,
      mutabakat: {
        aktif: Boolean(m.aktif),
        taslak_mod: m.taslak_mod !== false,
        taban_bakiye: num(m.taban_bakiye, d.mutabakat.taban_bakiye),
        frekans: parseFrekans(m.frekans, d.mutabakat.frekans),
      },
      odeme_talebi: {
        aktif: Boolean(o.aktif),
        taslak_mod: o.taslak_mod !== false,
        min_ortalama_gecikme_gun: num(
          o.min_ortalama_gecikme_gun,
          d.odeme_talebi.min_ortalama_gecikme_gun,
          0,
          3650
        ),
        min_gecikmis_tutar: num(o.min_gecikmis_tutar, d.odeme_talebi.min_gecikmis_tutar),
        kanal: (['email', 'whatsapp', 'her-ikisi'].includes(kanal)
          ? kanal
          : d.odeme_talebi.kanal) as OdemeTalepKanal,
        frekans: parseFrekans(o.frekans, d.odeme_talebi.frekans),
      },
      calisma_saati: saat(raw.calisma_saati, d.calisma_saati),
      sadece_is_gunu: raw.sadece_is_gunu !== false,
      updated_at: String(raw.updated_at || new Date().toISOString()),
    }
  }

  // v1 → v2 göç: eski otomasyon (kanal-kurallar) = Ödeme Talebi bloğu.
  const eskiKurallar = Array.isArray(raw.kurallar) ? (raw.kurallar as Record<string, unknown>[]) : []
  const aktifEsikler = eskiKurallar
    .filter((r) => r && r.aktif)
    .map((r) => num(r.min_ortalama_gecikme_gun, d.odeme_talebi.min_ortalama_gecikme_gun, 0, 3650))
  const minGun = aktifEsikler.length
    ? Math.min(...aktifEsikler)
    : d.odeme_talebi.min_ortalama_gecikme_gun
  return {
    version: 2,
    mutabakat: {
      aktif: false,
      taslak_mod: true,
      taban_bakiye: d.mutabakat.taban_bakiye,
      frekans: d.mutabakat.frekans,
    },
    odeme_talebi: {
      aktif: Boolean(raw.otomasyon_aktif),
      taslak_mod: raw.taslak_mod !== false,
      min_ortalama_gecikme_gun: minGun,
      min_gecikmis_tutar: d.odeme_talebi.min_gecikmis_tutar,
      kanal: 'her-ikisi',
      frekans: d.odeme_talebi.frekans,
    },
    calisma_saati: saat(raw.calisma_saati, d.calisma_saati),
    sadece_is_gunu: raw.sadece_is_gunu !== false,
    updated_at: String(raw.updated_at || new Date().toISOString()),
  }
}

/** İki bloktan en az biri aktif mi? */
export function automationAnyActive(settings: AutomationSettings): boolean {
  return settings.mutabakat.aktif || settings.odeme_talebi.aktif
}

export async function loadAutomationSettings(userId: string): Promise<AutomationSettings> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('body_preview,sent_at')
    .eq('ilgili_tip', AUTOMATION_SETTINGS_TIP)
    .eq('ilgili_id', userId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data?.body_preview) return createDefaultAutomationSettings()

  try {
    return parseSettings(JSON.parse(String(data.body_preview)))
  } catch {
    return createDefaultAutomationSettings()
  }
}

export async function saveAutomationSettings(userId: string, settings: AutomationSettings) {
  const normalized = parseSettings({
    ...settings,
    updated_at: new Date().toISOString(),
  })

  const admin = createAdminClient()
  const { error } = await admin.from('mail_gonderim_log').insert({
    ilgili_id: userId,
    ilgili_tip: AUTOMATION_SETTINGS_TIP,
    mail_to: userId,
    subject: automationAnyActive(normalized) ? 'Otomasyon aktif' : 'Otomasyon kapalı',
    body_preview: JSON.stringify(normalized),
    kaynak: AUTOMATION_LOG_KAYNAK,
    sent_at: new Date().toISOString(),
  })
  if (error) throw error
  return normalized
}

export async function listAutomationUserIds(): Promise<string[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('mail_gonderim_log')
    .select('ilgili_id,body_preview,sent_at')
    .eq('ilgili_tip', AUTOMATION_SETTINGS_TIP)
    .order('sent_at', { ascending: false })

  if (error) throw error

  const seen = new Set<string>()
  const active: string[] = []

  for (const row of data || []) {
    const userId = String(row.ilgili_id || '')
    if (!userId || seen.has(userId)) continue
    seen.add(userId)

    try {
      const settings = parseSettings(JSON.parse(String(row.body_preview || '{}')))
      if (automationAnyActive(settings)) active.push(userId)
    } catch {
      // ignore malformed rows
    }
  }

  return active
}

export function automationGloballyEnabled() {
  return process.env.OTOMATIK_TAHSILAT_ENABLED === 'true'
}

export function validateAutomationSettingsInput(input: Partial<AutomationSettings>) {
  if (input.calisma_saati && !/^\d{2}:\d{2}$/.test(input.calisma_saati)) {
    throw new Error('Çalışma saati HH:mm formatında olmalıdır.')
  }
  const o = input.odeme_talebi
  if (o) {
    if (o.min_ortalama_gecikme_gun < 0 || o.min_ortalama_gecikme_gun > 3650) {
      throw new Error('Ortalama gecikme eşiği 0–3650 gün arasında olmalıdır.')
    }
    if (o.min_gecikmis_tutar < 0) {
      throw new Error('Taban gecikmiş tutar negatif olamaz.')
    }
  }
  if (input.mutabakat && input.mutabakat.taban_bakiye < 0) {
    throw new Error('Taban bakiye negatif olamaz.')
  }
}
