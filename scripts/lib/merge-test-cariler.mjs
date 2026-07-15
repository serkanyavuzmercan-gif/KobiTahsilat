import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const AGING_BUCKETS = [
  'Vadesi gelmemiş',
  '1–30 gün',
  '31–60 gün',
  '61–90 gün',
  '90+ gün',
]

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function loadTestCariler(root = path.join(__dirname, '..', '..')) {
  const file = path.join(root, 'data', 'test-cariler.json')
  if (!fs.existsSync(file)) return []
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Array.isArray(raw.cariler) ? raw.cariler : []
}

export function mergeTestCariler(snapshot, root) {
  const testCariler = loadTestCariler(root)
  if (!testCariler.length) return snapshot

  const byCode = new Map(snapshot.cariler.map((cari) => [cari.cari_kod, cari]))
  for (const testCari of testCariler) {
    byCode.set(testCari.cari_kod, testCari)
  }

  const cariler = [...byCode.values()].sort((a, b) => b.bakiye - a.bakiye)
  const aging = Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, 0]))
  for (const cari of cariler) {
    for (const bucket of AGING_BUCKETS) {
      aging[bucket] = Math.round((aging[bucket] + (cari.aging?.[bucket] || 0)) * 100) / 100
    }
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
