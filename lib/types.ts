export const AGING_BUCKETS = [
  'Vadesi gelmemiş',
  '1–30 gün',
  '31–60 gün',
  '61–90 gün',
  '90+ gün',
] as const

export type AgingBucket = (typeof AGING_BUCKETS)[number]
export type AgingTotals = Record<AgingBucket, number>

export type AcikKalem = {
  evrak_no: string | null
  belge_no: string | null
  evrak_tarihi: string | null
  vade_tarihi: string | null
  gecikme_gun: number
  aging_bucket: AgingBucket
  tutar: number
  temsilci: string | null
}

export type EmailGuven = 'dogrulanmis' | 'yuksek' | 'aday'

export type MailSenderAccount = {
  id: string
  email: string
  ad_soyad: string | null
  varsayilan: boolean
  sistem: boolean
}

export type EmailAday = {
  email: string
  kaynak: string
  guven: EmailGuven
  adet: number
  son_tarih: string | null
  eslesme_notu: string | null
}

export type TelefonAday = {
  telefon: string
  kaynak: string
  guven: EmailGuven
  adet: number
  son_tarih: string | null
  eslesme_notu: string | null
}

export type CariYanitKayit = {
  id: string
  kanal: 'email' | 'whatsapp'
  tarih: string
  gonderen: string | null
  ozet: string
  detay: string
}

export type CariYanitOzet = {
  email: CariYanitKayit[]
  whatsapp: CariYanitKayit[]
  son_email: CariYanitKayit | null
  son_whatsapp: CariYanitKayit | null
}

export type CariBakiye = {
  cari_kod: string
  firma_adi: string
  email: string | null
  email_adresleri: string[]
  email_kaynagi?: string | null
  email_guven?: EmailGuven | null
  email_adaylari: EmailAday[]
  telefon: string | null
  telefon_numaralari: string[]
  telefon_kaynagi?: string | null
  telefon_guven?: EmailGuven | null
  telefon_adaylari: TelefonAday[]
  bakiye: number
  gecikmis_bakiye: number
  odeme_vadesi: string | null
  vade_gun: number | null
  aging: AgingTotals
  acik_kalemler: AcikKalem[]
}

export type TahsilatSnapshot = {
  sourced_at: string
  source: string
  snapshot_tarihi: string
  note: string
  cari_sayisi: number
  toplam_alacak: number
  toplam_gecikmis: number
  aging: AgingTotals
  cariler: CariBakiye[]
  email_enriched_at?: string
  email_ozet?: {
    toplam_cari: number
    gonderime_hazir: number
    adayli: number
    eksik: number
    gmail_tarandi: boolean
    gmail_aday_sayisi: number
    gmail_kaynagi?: string
  }
  telefon_enriched_at?: string
  telefon_ozet?: {
    toplam_cari: number
    gonderime_hazir: number
    adayli: number
    eksik: number
  }
}

/** ss reposu ile aynı işaret kuralı: bakiye > 0 → müşteri bize borçlu (tahsilat). */
export function isTahsilat(bakiye: number): boolean {
  return bakiye > 0.009
}

export function formatTL(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Plan adından gün: "60 GÜN" → 60 (ss/lib/cari-vade.ts ile uyumlu). */
export function gunFromPlanAdi(planAdi: string | null | undefined): number | null {
  if (!planAdi) return null
  const s = planAdi.toLocaleLowerCase('tr')
  const m = s.match(/(\d+)\s*g[üu]n/)
  if (m) return parseInt(m[1]!, 10)
  if (/pe[şs]in/.test(s)) return 0
  return null
}
