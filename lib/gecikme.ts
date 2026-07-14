import type { AcikKalem, CariBakiye } from './types'

/** Vadesi geçmiş kalemler için tutar ağırlıklı ortalama gecikme günü. */
export function ortalamaGecikmeGunFromKalemler(kalemler: AcikKalem[]): number | null {
  let weightedSum = 0
  let total = 0

  for (const kalem of kalemler) {
    if (kalem.gecikme_gun > 0 && kalem.tutar > 0) {
      weightedSum += kalem.gecikme_gun * kalem.tutar
      total += kalem.tutar
    }
  }

  if (total <= 0) return null
  return Math.round(weightedSum / total)
}

export function cariOrtalamaGecikmeGun(cari: CariBakiye): number | null {
  return ortalamaGecikmeGunFromKalemler(cari.acik_kalemler)
}

export function portfoyOrtalamaGecikmeGun(cariler: CariBakiye[]): number | null {
  let weightedSum = 0
  let total = 0

  for (const cari of cariler) {
    for (const kalem of cari.acik_kalemler) {
      if (kalem.gecikme_gun > 0 && kalem.tutar > 0) {
        weightedSum += kalem.gecikme_gun * kalem.tutar
        total += kalem.tutar
      }
    }
  }

  if (total <= 0) return null
  return Math.round(weightedSum / total)
}

export function formatGecikmeGun(gun: number | null): string {
  if (gun == null) return '—'
  return `${gun} gün`
}
