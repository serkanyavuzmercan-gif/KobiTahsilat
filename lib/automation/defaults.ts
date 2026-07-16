import type { AutomationSettings } from './types'

export function createDefaultAutomationSettings(): AutomationSettings {
  return {
    version: 2,
    mutabakat: {
      aktif: false,
      taslak_mod: true,
      taban_bakiye: 1000,
    },
    odeme_talebi: {
      aktif: false,
      taslak_mod: true,
      min_ortalama_gecikme_gun: 20,
      min_gecikmis_tutar: 1000,
      kanal: 'her-ikisi',
    },
    calisma_saati: '09:00',
    sadece_is_gunu: true,
    updated_at: new Date().toISOString(),
  }
}
