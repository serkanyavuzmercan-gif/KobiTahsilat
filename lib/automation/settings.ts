import 'server-only'
import { createDefaultAutomationSettings } from './defaults'
import type { AutomationRule, AutomationSettings } from './types'
import { AUTOMATION_LOG_KAYNAK, AUTOMATION_SETTINGS_TIP } from '../automation-log'
import { createAdminClient } from '../supabase/admin'

function parseSettings(value: unknown): AutomationSettings {
  const defaults = createDefaultAutomationSettings()
  if (!value || typeof value !== 'object') return defaults

  const raw = value as Partial<AutomationSettings>
  const kurallar: AutomationRule[] = Array.isArray(raw.kurallar)
    ? raw.kurallar
        .map((rule) => ({
          id: String(rule.id || ''),
          kanal: (rule.kanal === 'whatsapp' ? 'whatsapp' : 'email') as AutomationRule['kanal'],
          min_ortalama_gecikme_gun: Math.max(
            0,
            Math.round(Number(rule.min_ortalama_gecikme_gun) || 0)
          ),
          aktif: Boolean(rule.aktif),
          etiket: String(rule.etiket || '').trim() || 'Kural',
        }))
        .filter((rule) => rule.id)
    : defaults.kurallar

  return {
    version: 1,
    otomasyon_aktif: Boolean(raw.otomasyon_aktif),
    taslak_mod: raw.taslak_mod !== false,
    kurallar: kurallar.length ? kurallar : defaults.kurallar,
    calisma_saati: /^\d{2}:\d{2}$/.test(String(raw.calisma_saati || ''))
      ? String(raw.calisma_saati)
      : defaults.calisma_saati,
    sadece_is_gunu: raw.sadece_is_gunu !== false,
    updated_at: String(raw.updated_at || new Date().toISOString()),
  }
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
    subject: normalized.otomasyon_aktif ? 'Otomasyon aktif' : 'Otomasyon kapalı',
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
      if (settings.otomasyon_aktif) active.push(userId)
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

  for (const rule of input.kurallar || []) {
    if (rule.min_ortalama_gecikme_gun < 0 || rule.min_ortalama_gecikme_gun > 3650) {
      throw new Error('Ortalama gecikme eşiği 0–3650 gün arasında olmalıdır.')
    }
  }
}
