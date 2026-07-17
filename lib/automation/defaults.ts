import type { AutomationSettings } from './types'

export function createDefaultAutomationSettings(): AutomationSettings {
  return {
    version: 2,
    mutabakat: {
      aktif: false,
      taslak_mod: true,
      taban_bakiye: 1000,
      // Varsayılan: her ay (ayın 1'i; hafta sonuna denk gelirse ilk iş günü).
      frekans: { tur: 'aylik', gun: 1 },
    },
    odeme_talebi: {
      aktif: false,
      taslak_mod: true,
      min_ortalama_gecikme_gun: 20,
      min_gecikmis_tutar: 1000,
      kanal: 'her-ikisi',
      // Varsayılan: her hafta Cuma (5 = Cuma).
      frekans: { tur: 'haftalik', gun: 5 },
    },
    calisma_saati: '09:00',
    sadece_is_gunu: true,
    updated_at: new Date().toISOString(),
  }
}
