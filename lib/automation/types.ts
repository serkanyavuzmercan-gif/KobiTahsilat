export type AutomationChannel = 'email' | 'whatsapp'

export type AutomationRule = {
  id: string
  kanal: AutomationChannel
  /** Ortalama gecikme bu gün ve üzerindeyse kural tetiklenir. */
  min_ortalama_gecikme_gun: number
  aktif: boolean
  etiket: string
}

export type AutomationSettings = {
  version: 1
  otomasyon_aktif: boolean
  /** true: gönderim yapılmaz, yalnızca adaylar raporlanır. */
  taslak_mod: boolean
  kurallar: AutomationRule[]
  /** HH:mm — cron bu saatten sonra çalışır (Türkiye). */
  calisma_saati: string
  sadece_is_gunu: boolean
  updated_at: string
}

export type WhatsAppUserConnection = {
  telefon: string | null
  display: string | null
  baglandi_at: string | null
}

export type AutomationConnectionsStatus = {
  email_bagli: boolean
  email_varsayilan: string | null
  whatsapp_kullanici: WhatsAppUserConnection
  whatsapp_api_yapilandirildi: boolean
  whatsapp_gonderim_acik: boolean
  mutabakat_gonderim_acik: boolean
  otomasyon_global_acik: boolean
}

export type AutomationRunCandidate = {
  cari_kod: string
  firma_adi: string
  kanal: AutomationChannel
  kural_id: string
  ortalama_gecikme_gun: number
  gecikmis_bakiye: number
  alici: string | null
  engel: string | null
}

export type AutomationRunResult = {
  basladi: string
  bitti: string
  taslak_mod: boolean
  kullanici_id: string
  aday_sayisi: number
  gonderilen: number
  atlanan: number
  hatalar: string[]
  adaylar: AutomationRunCandidate[]
}
