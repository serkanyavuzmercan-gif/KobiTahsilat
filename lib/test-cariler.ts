import { readFileSync, existsSync } from 'fs'
import path from 'path'
import type { AgingBucket, AgingTotals, CariBakiye, TahsilatSnapshot } from './types'
import { AGING_BUCKETS } from './types'
import { TEST_CARI_KODU } from './constants'

const TEST_CARILER_FILE = path.join(process.cwd(), 'data', 'test-cariler.json')

export function loadTestCariler(): CariBakiye[] {
  if (!existsSync(TEST_CARILER_FILE)) return []
  const raw = JSON.parse(readFileSync(TEST_CARILER_FILE, 'utf8')) as { cariler?: CariBakiye[] }
  return Array.isArray(raw.cariler) ? raw.cariler : []
}

function emptyAging(): AgingTotals {
  return Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, 0])) as AgingTotals
}

function addAging(target: AgingTotals, source: AgingTotals) {
  for (const bucket of AGING_BUCKETS) {
    target[bucket] = Math.round((target[bucket] + (source[bucket] || 0)) * 100) / 100
  }
}

/** Test carilerini snapshot'a ekler; aynı cari kodu varsa test tanımı önceliklidir. */
export function mergeTestCariler(snapshot: TahsilatSnapshot): TahsilatSnapshot {
  const testCariler = loadTestCariler()
  if (!testCariler.length) return snapshot

  const byCode = new Map(snapshot.cariler.map((cari) => [cari.cari_kod, cari]))
  for (const testCari of testCariler) {
    byCode.set(testCari.cari_kod, testCari)
  }

  const cariler = [...byCode.values()].sort((a, b) => b.bakiye - a.bakiye)
  const aging = emptyAging()
  for (const cari of cariler) {
    addAging(aging, cari.aging)
  }

  return {
    ...snapshot,
    cariler,
    cari_sayisi: cariler.length,
    toplam_alacak: Math.round(cariler.reduce((sum, cari) => sum + cari.bakiye, 0) * 100) / 100,
    toplam_gecikmis: Math.round(cariler.reduce((sum, cari) => sum + cari.gecikmis_bakiye, 0) * 100) / 100,
    aging,
  }
}

export function isTestCari(cariKod: string): boolean {
  return cariKod === TEST_CARI_KODU || loadTestCariler().some((cari) => cari.cari_kod === cariKod)
}
