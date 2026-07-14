#!/usr/bin/env node
/**
 * Tahsilat snapshot telefon alanlarını SS Supabase cari kartlarından zenginleştirir.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

loadEnv()

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Eksik env: ${key}`)
    process.exit(1)
  }
}

const snapshotPath = path.join(root, 'data', 'tahsilat_snapshot.json')
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
const byCode = new Map(snapshot.cariler.map((cari) => [cari.cari_kod, cari]))

function normalizePhone(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  digits = digits.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('90') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+90${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('5')) return `+90${digits}`
  if (digits.length === 10 && /^[2-4]/.test(digits)) return `+90${digits}`
  return null
}

function parsePhones(value) {
  return [
    ...new Set(
      String(value || '')
        .split(/[;,\n/|]+/)
        .map((item) => normalizePhone(item))
        .filter(Boolean)
    ),
  ]
}

const cariler = await restAll('cariler', 'cari_kod,firma_adi,telefon')
let enriched = 0

for (const row of cariler) {
  const code = String(row.cari_kod || '').trim()
  const cari = byCode.get(code)
  if (!cari) continue
  const phones = parsePhones(row.telefon)
  if (!phones.length) continue

  const existing = new Set(cari.telefon_numaralari || [])
  for (const phone of phones) existing.add(phone)
  const merged = [...existing]
  const mobile = merged.filter((p) => /^\+905\d{9}$/.test(p))
  const ordered = [...new Set([...mobile, ...merged])]

  cari.telefon = ordered[0] || null
  cari.telefon_numaralari = ordered
  cari.telefon_kaynagi = 'SS cari kartı'
  cari.telefon_guven = 'dogrulanmis'
  cari.telefon_adaylari = cari.telefon_adaylari || []
  enriched++
}

const ready = snapshot.cariler.filter((c) => c.telefon).length
const adayli = snapshot.cariler.filter(
  (c) => !c.telefon && (c.telefon_adaylari || []).length > 0
).length

snapshot.telefon_ozet = {
  toplam_cari: snapshot.cariler.length,
  gonderime_hazir: ready,
  adayli,
  eksik: snapshot.cariler.length - ready - adayli,
}
snapshot.telefon_enriched_at = new Date().toISOString()

fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Telefon zenginleştirme tamam: ${enriched} cari güncellendi, ${ready} hazır.`)

async function restAll(table, select, filters = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const items = []
  let offset = 0
  const page = 1000
  while (true) {
    const params = new URLSearchParams({ select, offset: String(offset), limit: String(page) })
    for (const [k, v] of Object.entries(filters)) params.set(k, v)
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!response.ok) throw new Error(`${table}: ${response.status}`)
    const batch = await response.json()
    items.push(...batch)
    if (batch.length < page) break
    offset += page
  }
  return items
}

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
    }
  }
}
