import type { AutomationRule, AutomationSettings } from './types'

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'email-gecikme-30',
    kanal: 'email',
    min_ortalama_gecikme_gun: 30,
    aktif: false,
    etiket: '30 gün ortalama gecikme — e-posta',
  },
  {
    id: 'whatsapp-gecikme-45',
    kanal: 'whatsapp',
    min_ortalama_gecikme_gun: 45,
    aktif: false,
    etiket: '45 gün ortalama gecikme — WhatsApp',
  },
  {
    id: 'email-gecikme-60',
    kanal: 'email',
    min_ortalama_gecikme_gun: 60,
    aktif: false,
    etiket: '60 gün ortalama gecikme — e-posta',
  },
]

export function createDefaultAutomationSettings(): AutomationSettings {
  return {
    version: 1,
    otomasyon_aktif: false,
    taslak_mod: true,
    kurallar: DEFAULT_AUTOMATION_RULES.map((rule) => ({ ...rule })),
    calisma_saati: '09:00',
    sadece_is_gunu: true,
    updated_at: new Date().toISOString(),
  }
}
