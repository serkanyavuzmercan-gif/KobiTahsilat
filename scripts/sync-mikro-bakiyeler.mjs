#!/usr/bin/env node
/**
 * Mikro ERP'den açık tahsilat bakiyelerini çeker → data/tahsilat_snapshot.json
 * ss reposundaki cari-net işaret kuralı ile aynı (bakiye>0 = tahsilat).
 *
 * Kullanım: .env.local doldur → npm run sync:mikro
 */
import crypto from 'crypto'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { mergeTestCariler } from './lib/merge-test-cariler.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

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

function hash(sifreGun) {
  const today = new Date().toISOString().split('T')[0]
  return crypto.createHash('md5').update(`${today} ${sifreGun}`).digest('hex')
}

function post(baseUrl, bodyObj) {
  const body = JSON.stringify(bodyObj)
  const u = new URL(baseUrl.replace(/\/$/, '') + '/SqlVeriOkuV2')
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 180000,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    req.write(body)
    req.end()
  })
}

function rows(res) {
  return res?.result?.[0]?.Data?.[0]?.SQLResult1 || []
}

function gunFromPlanAdi(planAdi) {
  if (!planAdi) return null
  const s = planAdi.toLocaleLowerCase('tr')
  const m = s.match(/(\d+)\s*g[üu]n/)
  if (m) return parseInt(m[1], 10)
  if (/pe[şs]in/.test(s)) return 0
  return null
}

const ODEME_PLANI_GUN = new Map([
  [0, 0], [1, 0], [2, 30], [3, 60], [5, 45],
  [6, 75], [7, 90], [8, 100], [9, 120], [10, 7],
])

function vadeGunHesapla(plan) {
  const planNo = numberOrNull(plan?.plan_no)
  const ortGun = numberOrNull(plan?.vade_gun)
  if (planNo != null && planNo < 0) return Math.abs(planNo)
  if (planNo === 0) return 0
  if (ortGun != null && ortGun > 0) return ortGun
  const fromName = gunFromPlanAdi(plan?.odeme_vadesi)
  if (fromName != null) return fromName
  return planNo != null ? (ODEME_PLANI_GUN.get(planNo) ?? null) : null
}

function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function dateOrNull(value) {
  if (!value) return null
  const iso = String(value).replace('T', ' ').split(' ')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number(iso.slice(0, 4)) < 1900) return null
  return iso
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + (days || 0))
  return date.toISOString().slice(0, 10)
}

function diffDays(later, earlier) {
  return Math.round(
    (new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) /
      86400000
  )
}

function agingBucket(gecikmeGun) {
  if (gecikmeGun <= 0) return 'Vadesi gelmemiş'
  if (gecikmeGun <= 30) return '1–30 gün'
  if (gecikmeGun <= 60) return '31–60 gün'
  if (gecikmeGun <= 90) return '61–90 gün'
  return '90+ gün'
}

function money(value) {
  return Math.round(value * 100) / 100
}

function emailAdresleri(value) {
  const candidates = String(value || '')
    .split(/[;,\s]+/)
    .map((email) => email.trim().toLocaleLowerCase('tr'))
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return [...new Set(candidates)]
}

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

function telefonAdresleri(plan) {
  const raw = [plan.cep_tel, plan.tel1, plan.tel2].filter(Boolean).join('; ')
  const candidates = String(raw || '')
    .split(/[;,\n/|]+/)
    .map((item) => normalizePhone(item))
    .filter(Boolean)
  const mobile = candidates.filter((p) => /^\+905\d{9}$/.test(p))
  const ordered = [...new Set([...mobile, ...candidates])]
  return ordered
}

loadEnv()

const required = [
  'MIKRO_BASE_URL',
  'MIKRO_API_KEY',
  'MIKRO_FIRMA_KODU',
  'MIKRO_CALISMA_YILI',
  'MIKRO_KULLANICI_KODU',
  'MIKRO_SIFRE_GUN',
]
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Eksik env: ${k}`)
    process.exit(1)
  }
}

const auth = {
  ApiKey: process.env.MIKRO_API_KEY,
  FirmaKodu: process.env.MIKRO_FIRMA_KODU,
  CalismaYili: Number(process.env.MIKRO_CALISMA_YILI),
  KullaniciKodu: process.env.MIKRO_KULLANICI_KODU,
  Sifre: hash(process.env.MIKRO_SIFRE_GUN),
}

const sql = `
SELECT
  cha.cha_kod AS cari_kod,
  ch.cari_unvan1 AS firma_adi,
  LTRIM(RTRIM(ISNULL(cha.cha_evrakno_seri,''))) AS seri,
  cha.cha_evrakno_sira AS sira,
  LTRIM(RTRIM(ISNULL(cha.cha_belge_no,''))) AS belge_no,
  CONVERT(varchar(10), cha.cha_tarihi, 23) AS evrak_tarihi,
  CONVERT(varchar(10), cha.cha_vade, 23) AS cha_vade,
  cha.cha_tip AS tip,
  ABS(ISNULL(cha.cha_meblag,0)) AS meblag,
  ISNULL(cha.cha_d_cins,0) AS doviz_cinsi,
  ISNULL(cha.cha_d_kur,1) AS kur,
  ISNULL(cha.cha_meblag_ana_doviz_icin_gecersiz_fl,0) AS gecersiz_doviz,
  LTRIM(RTRIM(ISNULL(cha.cha_satici_kodu,''))) AS temsilci
FROM CARI_HESAP_HAREKETLERI cha WITH (NOLOCK)
LEFT JOIN CARI_HESAPLAR ch WITH (NOLOCK) ON ch.cari_kod = cha.cha_kod
WHERE ISNULL(cha.cha_iptal,0)=0 AND ISNULL(cha.cha_hidden,0)=0
  AND cha.cha_kod LIKE '120%'
  AND cha.cha_kod NOT LIKE '120.B%'
  AND cha.cha_kod NOT LIKE '128%'
  AND ISNULL(cha.cha_meblag,0) <> 0
ORDER BY cha.cha_kod, cha.cha_tarihi`
// NOT: 320* tedarikçiler hariç (fazla ödemede bize borçlu görünür, tahsilat hedefi değil).
// ŞAHLAN (120.01.0001) ve AYGÜN SARI (120.01.4249) artık dahil — normal müşteridirler.

const planSql = `SELECT cari_kod, CAST(cari_odemeplan_no AS VARCHAR(20)) AS plan_no,
  ISNULL(cari_EMail,'') AS email,
  ISNULL(cari_CepTel,'') AS cep_tel,
  ISNULL(cari_Tel1,'') AS tel1,
  ISNULL(cari_Tel2,'') AS tel2,
  (SELECT odp_adi FROM ODEME_PLANLARI WHERE odp_no = cari_odemeplan_no) AS odeme_vadesi,
  CAST((SELECT odp_ortgun FROM ODEME_PLANLARI WHERE odp_no = cari_odemeplan_no) AS VARCHAR(20)) AS vade_gun
  FROM CARI_HESAPLAR WHERE cari_kod LIKE '120%'`

const base = process.env.MIKRO_BASE_URL
const balRes = await post(base, { Mikro: auth, SQLSorgu: sql })
if (balRes?.result?.[0]?.IsError) {
  console.error(balRes.result[0].ErrorMessage)
  process.exit(1)
}
const planRes = await post(base, { Mikro: auth, SQLSorgu: planSql })
const planMap = new Map(
  rows(planRes).map((p) => [String(p.cari_kod).trim(), p])
)

const grouped = new Map()
for (const row of rows(balRes)) {
  const cariKod = String(row.cari_kod || '').trim()
  if (!cariKod) continue

  // MikRapor doğrulanmış TL kuralı: TL harekette kurla çarpma; geçersiz döviz satırını sayma.
  const meblag = Math.abs(Number(row.meblag || 0))
  const dovizCinsi = Number(row.doviz_cinsi || 0)
  const kur = Number(row.kur || 1) || 1
  const tl = Number(row.gecersiz_doviz || 0) === 1 ? 0 : meblag * (dovizCinsi === 0 ? 1 : kur)
  const tip = Number(row.tip)

  const entry = grouped.get(cariKod) || {
    cari_kod: cariKod,
    firma_adi: String(row.firma_adi || '').trim() || cariKod,
    net: 0,
    docs: [],
  }
  entry.net += tip === 0 ? tl : -tl
  entry.docs.push({
    tip,
    tl: money(tl),
    seri: String(row.seri || '').trim(),
    sira: row.sira != null ? String(row.sira).trim() : '',
    belge_no: String(row.belge_no || '').trim() || null,
    evrak_tarihi: dateOrNull(row.evrak_tarihi),
    cha_vade: dateOrNull(row.cha_vade),
    temsilci: String(row.temsilci || '').trim() || null,
  })
  grouped.set(cariKod, entry)
}

const snapshotTarihi = new Date().toISOString().slice(0, 10)
const emptyAging = () => ({
  'Vadesi gelmemiş': 0,
  '1–30 gün': 0,
  '31–60 gün': 0,
  '61–90 gün': 0,
  '90+ gün': 0,
})
const toplamAging = emptyAging()
const cariler = []

for (const entry of grouped.values()) {
  const bakiye = money(entry.net)
  if (bakiye < 1) continue

  const plan = planMap.get(entry.cari_kod) || {}
  const odemeVadesi = plan.odeme_vadesi ? String(plan.odeme_vadesi).trim() : null
  const vadeGun = vadeGunHesapla(plan)
  const emails = emailAdresleri(plan.email)
  const telefonlar = telefonAdresleri(plan)
  let kalan = bakiye

  // FIFO ödemeler eski borçları kapatır; açık kalanlar en yeni borç evraklarından geriye dağılır.
  const charges = entry.docs
    .filter((doc) => doc.tip === 0 && doc.tl > 0)
    .sort((a, b) => (b.evrak_tarihi || '').localeCompare(a.evrak_tarihi || ''))

  const acikKalemler = []
  const aging = emptyAging()
  for (const doc of charges) {
    if (kalan <= 0.005) break
    const tutar = money(Math.min(doc.tl, kalan))
    kalan = money(kalan - tutar)
    const vadeTarihi =
      doc.cha_vade ||
      (doc.evrak_tarihi ? addDays(doc.evrak_tarihi, vadeGun || 0) : null)
    const gecikmeGun = vadeTarihi ? diffDays(snapshotTarihi, vadeTarihi) : 0
    const bucket = agingBucket(gecikmeGun)
    aging[bucket] = money(aging[bucket] + tutar)
    toplamAging[bucket] = money(toplamAging[bucket] + tutar)
    acikKalemler.push({
      evrak_no: doc.seri || doc.sira ? `${doc.seri}${doc.seri && doc.sira ? '-' : ''}${doc.sira}` : null,
      belge_no: doc.belge_no,
      evrak_tarihi: doc.evrak_tarihi,
      vade_tarihi: vadeTarihi,
      gecikme_gun: gecikmeGun,
      aging_bucket: bucket,
      tutar,
      temsilci: doc.temsilci,
    })
  }

  acikKalemler.sort((a, b) => (a.vade_tarihi || '9999').localeCompare(b.vade_tarihi || '9999'))
  cariler.push({
    cari_kod: entry.cari_kod,
    firma_adi: entry.firma_adi,
    email: emails[0] || null,
    email_adresleri: emails,
    telefon: telefonlar[0] || null,
    telefon_numaralari: telefonlar,
    telefon_kaynagi: telefonlar.length ? 'Mikro cari kartı' : null,
    telefon_guven: telefonlar.length ? 'dogrulanmis' : null,
    telefon_adaylari: [],
    bakiye,
    gecikmis_bakiye: money(
      aging['1–30 gün'] + aging['31–60 gün'] + aging['61–90 gün'] + aging['90+ gün']
    ),
    odeme_vadesi: odemeVadesi,
    vade_gun: vadeGun,
    aging,
    acik_kalemler: acikKalemler,
  })
}
cariler.sort((a, b) => b.bakiye - a.bakiye)

const out = mergeTestCariler(
  {
    sourced_at: new Date().toISOString(),
    source: `Mikro firma ${process.env.MIKRO_FIRMA_KODU}`,
    snapshot_tarihi: snapshotTarihi,
    note: 'MikRapor TL/vade + ss cari-net/FIFO kuralları. Bakiye>0 alacağımız; yalnızca 120* müşteriler, 320* tedarikçiler + 128* hariç. ŞAHLAN/AYGÜN dahil.',
    cari_sayisi: cariler.length,
    toplam_alacak: Math.round(cariler.reduce((s, c) => s + c.bakiye, 0) * 100) / 100,
    toplam_gecikmis: money(cariler.reduce((s, c) => s + c.gecikmis_bakiye, 0)),
    aging: toplamAging,
    cariler,
  },
  root
)

const dest = path.join(root, 'data', 'tahsilat_snapshot.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 2))
console.log(`OK → ${dest}`)
console.log(`cari=${out.cari_sayisi} toplam=${out.toplam_alacak}`)
console.log(`email=${cariler.filter((c) => c.email).length} eksik=${cariler.filter((c) => !c.email).length}`)
