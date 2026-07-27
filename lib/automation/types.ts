export type AutomationChannel = 'email' | 'whatsapp'
export type OdemeTalepKanal = 'email' | 'whatsapp' | 'her-ikisi'

export type FrekansTur = 'gunluk' | 'haftalik' | 'aylik'
/** Otomasyon sıklığı. gun: haftalik→1=Pazartesi..7=Pazar; aylik→ayın günü 1-28; gunluk→kullanılmaz. */
export type Frekans = {
  tur: FrekansTur
  gun: number
}

/** Otomatik Mutabakat bloğu (bağımsız aç/kapa). */
export type MutabakatOtomasyon = {
  aktif: boolean
  /** Deneme modu: gönderme, yalnızca aday listesini çıkar. */
  taslak_mod: boolean
  /** Bu bakiyenin altındaki cariler otomatik mutabakata girmez. */
  taban_bakiye: number
  /** Sıklık: her kaç ayda bir (1=her ay, 2=her 2 ayda, 3=her 3 ayda). Cari başına periyot kilidi. */
  ay_araligi: number
}

/** Otomatik Ödeme Talebi bloğu (bağımsız aç/kapa). */
export type OdemeTalepOtomasyon = {
  aktif: boolean
  taslak_mod: boolean
  /** Ortalama gecikme bu gün ve üzerindeyse aday olur. */
  min_ortalama_gecikme_gun: number
  /** Bu tutarın altındaki gecikmiş bakiyeler gelmez. */
  min_gecikmis_tutar: number
  kanal: OdemeTalepKanal
  frekans: Frekans
}

export type AutomationSettings = {
  version: 2
  mutabakat: MutabakatOtomasyon
  odeme_talebi: OdemeTalepOtomasyon
  /** HH:mm — cron bu saatten sonra çalışır (Türkiye). */
  calisma_saati: string
  sadece_is_gunu: boolean
  updated_at: string
}

export type AutomationConnectionsStatus = {
  email_bagli: boolean
  email_varsayilan: string | null
  whatsapp_api_yapilandirildi: boolean
  whatsapp_gonderim_acik: boolean
  mutabakat_gonderim_acik: boolean
  otomasyon_global_acik: boolean
}

export type AutomationRunCandidate = {
  tur: 'mutabakat' | 'odeme_talebi'
  cari_kod: string
  firma_adi: string
  kanal: AutomationChannel
  ortalama_gecikme_gun: number | null
  gecikmis_bakiye: number
  bakiye: number
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
