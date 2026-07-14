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
  MAX(ch.cari_unvan1) AS firma_adi,
  ROUND(SUM(CASE WHEN cha.cha_tip=0 THEN ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1)
                 ELSE -ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1) END), 2) AS bakiye
FROM CARI_HESAP_HAREKETLERI cha WITH (NOLOCK)
LEFT JOIN CARI_HESAPLAR ch WITH (NOLOCK) ON ch.cari_kod = cha.cha_kod
WHERE ISNULL(cha.cha_iptal,0)=0
  AND (cha.cha_kod LIKE '120%' OR cha.cha_kod LIKE '320%')
  AND cha.cha_kod NOT LIKE '120.B%'
  AND cha.cha_kod NOT LIKE '128%'
  AND cha.cha_kod NOT IN ('120.01.0001','120.01.4249')
GROUP BY cha.cha_kod
HAVING ABS(SUM(CASE WHEN cha.cha_tip=0 THEN ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1)
                    ELSE -ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1) END)) >= 1
ORDER BY ABS(SUM(CASE WHEN cha.cha_tip=0 THEN ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1)
                      ELSE -ABS(ISNULL(cha.cha_meblag,0))*ISNULL(cha.cha_d_kur,1) END)) DESC`

const planSql = `SELECT cari_kod, CAST(cari_odemeplan_no AS VARCHAR(20)) AS plan_no,
  (SELECT odp_adi FROM ODEME_PLANLARI WHERE odp_no = cari_odemeplan_no) AS odeme_vadesi,
  CAST((SELECT odp_ortgun FROM ODEME_PLANLARI WHERE odp_no = cari_odemeplan_no) AS VARCHAR(20)) AS vade_gun
  FROM CARI_HESAPLAR WHERE cari_kod LIKE '120%' OR cari_kod LIKE '320%'`

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

const cariler = rows(balRes)
  .map((x) => {
    const cari_kod = String(x.cari_kod || '').trim()
    const bakiye = Number(x.bakiye || 0)
    if (bakiye <= 0) return null
    const p = planMap.get(cari_kod) || {}
    const odeme_vadesi = p.odeme_vadesi ? String(p.odeme_vadesi).trim() : null
    const fromName = gunFromPlanAdi(odeme_vadesi)
    const fromOrt =
      p.vade_gun != null && String(p.vade_gun).trim() !== ''
        ? Number(p.vade_gun)
        : null
    return {
      cari_kod,
      firma_adi: String(x.firma_adi || '').trim(),
      bakiye,
      odeme_vadesi,
      vade_gun: fromName ?? (fromOrt && fromOrt > 0 ? fromOrt : fromOrt),
    }
  })
  .filter(Boolean)
  .sort((a, b) => b.bakiye - a.bakiye)

const out = {
  sourced_at: new Date().toISOString(),
  source: `Mikro firma ${process.env.MIKRO_FIRMA_KODU}`,
  note: 'bakiye>0 tahsilat (alacağımız). HARIC ŞAHLAN/AYGÜN + 128 hariç. ss vade-takip işaret kuralı.',
  cari_sayisi: cariler.length,
  toplam_alacak: Math.round(cariler.reduce((s, c) => s + c.bakiye, 0) * 100) / 100,
  cariler,
}

const dest = path.join(root, 'data', 'tahsilat_snapshot.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 2))
console.log(`OK → ${dest}`)
console.log(`cari=${out.cari_sayisi} toplam=${out.toplam_alacak}`)
