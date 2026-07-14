import { readFileSync } from 'fs'
import path from 'path'
import type { CariBakiye, TahsilatSnapshot } from './types'
import { gunFromPlanAdi } from './types'

let cache: TahsilatSnapshot | null = null

function normalize(c: CariBakiye): CariBakiye {
  const vade_gun =
    c.vade_gun != null && c.vade_gun > 0
      ? c.vade_gun
      : gunFromPlanAdi(c.odeme_vadesi) ?? c.vade_gun
  return {
    ...c,
    cari_kod: c.cari_kod,
    firma_adi: c.firma_adi,
    email: c.email || null,
    email_adresleri: c.email_adresleri || (c.email ? [c.email] : []),
    email_adaylari: c.email_adaylari || [],
    telefon: c.telefon || null,
    telefon_numaralari:
      c.telefon_numaralari || (c.telefon ? [c.telefon] : []),
    telefon_adaylari: c.telefon_adaylari || [],
    bakiye: Number(c.bakiye) || 0,
    gecikmis_bakiye: Number(c.gecikmis_bakiye) || 0,
    odeme_vadesi: c.odeme_vadesi,
    vade_gun,
    acik_kalemler: c.acik_kalemler || [],
  }
}

export function loadSnapshot(): TahsilatSnapshot {
  if (cache) return cache
  const file = path.join(process.cwd(), 'data', 'tahsilat_snapshot.json')
  const raw = JSON.parse(readFileSync(file, 'utf8')) as TahsilatSnapshot
  const cariler = (raw.cariler || []).map(normalize).sort((a, b) => b.bakiye - a.bakiye)
  cache = {
    ...raw,
    cariler,
    cari_sayisi: cariler.length,
    toplam_alacak: Math.round(cariler.reduce((s, c) => s + c.bakiye, 0) * 100) / 100,
  }
  return cache
}

export function clearSnapshotCache() {
  cache = null
}

export function getCari(cariKod: string): CariBakiye | undefined {
  return loadSnapshot().cariler.find((c) => c.cari_kod === cariKod)
}

export function searchCariler(q: string): CariBakiye[] {
  const snap = loadSnapshot()
  const term = q.trim().toLocaleLowerCase('tr')
  if (!term) return snap.cariler
  return snap.cariler.filter(
    (c) =>
      c.firma_adi.toLocaleLowerCase('tr').includes(term) ||
      c.cari_kod.toLocaleLowerCase('tr').includes(term)
  )
}
