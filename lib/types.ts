export type CariBakiye = {
  cari_kod: string
  firma_adi: string
  bakiye: number
  odeme_vadesi: string | null
  vade_gun: number | null
}

export type TahsilatSnapshot = {
  sourced_at: string
  source: string
  note: string
  cari_sayisi: number
  toplam_alacak: number
  cariler: CariBakiye[]
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
