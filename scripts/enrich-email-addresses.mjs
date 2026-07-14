#!/usr/bin/env node
/**
 * Tahsilat snapshot'ındaki cari e-postalarını SS/Supabase ve Gmail geçmişiyle zenginleştirir.
 *
 * Güvenlik:
 * - Supabase ve Gmail yalnız okunur.
 * - Cari koduyla doğrudan bağlı SS kayıtları ana e-posta olabilir.
 * - Gmail sonuçları hiçbir zaman otomatik gönderime açılmaz; yalnız "aday" olarak yazılır.
 */
import crypto from 'crypto'
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
const currentByCode = new Map(snapshot.cariler.map((cari) => [cari.cari_kod, cari]))
const evidence = new Map()

function addEvidence(cariKod, rawEmail, kaynak, guven, tarih = null) {
  if (!currentByCode.has(cariKod)) return
  for (const email of emails(rawEmail)) {
    if (isInternal(email) || isNoise(email)) continue
    const key = `${cariKod}|${email}`
    const existing = evidence.get(key) || {
      email,
      kaynaklar: [],
      guven,
      adet: 0,
      son_tarih: null,
    }
    if (!existing.kaynaklar.includes(kaynak)) existing.kaynaklar.push(kaynak)
    existing.adet++
    if (tarih && (!existing.son_tarih || tarih > existing.son_tarih)) existing.son_tarih = tarih
    if (confidenceRank(guven) > confidenceRank(existing.guven)) existing.guven = guven
    evidence.set(key, existing)
  }
}

const [cariler, teklifler, services, mailboxes, talepler, mailThreads] = await Promise.all([
  restAll('cariler', 'id,cari_kod,firma_adi,email'),
  restAll('yurtici_teklif', 'teklif_no,cari_kod,cari_unvan,musteri_mail,teklif_tarihi'),
  restAll('services', 'cari_id,customer_email,scheduled_date'),
  restAll('teklif_talep_imap_accounts', 'email,aktif', { aktif: 'eq.true' }),
  restAll('teklif_talep', 'id,teklif_no,mail_from,mail_subject,mail_body_preview,mail_received_at,silindi'),
  restAll('teklif_talep_mail_thread', 'teklif_talep_id,mail_from,mail_subject,mail_body,mail_received_at,yon'),
])

const codeByCariId = new Map()
for (const row of cariler) {
  const code = clean(row.cari_kod)
  if (!code) continue
  codeByCariId.set(String(row.id), code)
  addEvidence(code, row.email, 'SS cari kartı', 'dogrulanmis')
}
for (const row of teklifler) {
  const code = clean(row.cari_kod)
  if (!code || code === '1' || code.startsWith('320')) continue
  addEvidence(code, row.musteri_mail, 'Eski teklif', 'yuksek', dateOnly(row.teklif_tarihi))
}
for (const row of services) {
  const code = codeByCariId.get(String(row.cari_id || ''))
  if (!code) continue
  addEvidence(code, row.customer_email, 'Servis kaydı', 'yuksek', dateOnly(row.scheduled_date))
}

// Gmail/IMAP'ten alınmış teklif talepleri Supabase'de tutulur. Teklif no üzerinden cari koduna
// birebir bağlanan gönderen ve thread adresleri yüksek güvenlidir.
const codeByTeklifNo = new Map()
for (const row of teklifler) {
  const teklifNo = clean(row.teklif_no)
  const code = clean(row.cari_kod)
  if (teklifNo && code && code !== '1' && !code.startsWith('320')) codeByTeklifNo.set(teklifNo, code)
}
const codeByTalepId = new Map()
for (const row of talepler) {
  if (row.silindi === true) continue
  const code = codeByTeklifNo.get(clean(row.teklif_no))
  if (!code) continue
  codeByTalepId.set(String(row.id), code)
  addEvidence(code, extractEmail(row.mail_from), 'Gmail teklif talebi', 'yuksek', dateOnly(row.mail_received_at))
}
for (const row of mailThreads) {
  const code = codeByTalepId.get(String(row.teklif_talep_id || ''))
  if (!code) continue
  addEvidence(code, extractEmail(row.mail_from), 'Gmail yazışma thread’i', 'yuksek', dateOnly(row.mail_received_at))
}

// Doğrudan cari koduyla bağlı geçmiş kayıtlar güvenilir; eksik ana adresleri bunlarla tamamla.
for (const cari of snapshot.cariler) {
  const direct = [...evidence.entries()]
    .filter(([key]) => key.startsWith(`${cari.cari_kod}|`))
    .map(([, value]) => value)
    .sort(sortEvidence)

  const existing = new Set(cari.email_adresleri || [])
  const merged = [...existing]
  for (const item of direct) if (!merged.includes(item.email)) merged.push(item.email)

  if (!cari.email && direct[0]) {
    cari.email = direct[0].email
    cari.email_kaynagi = direct[0].kaynaklar.join(' + ')
    cari.email_guven = direct[0].kaynaklar.length > 1 ? 'dogrulanmis' : direct[0].guven
  } else if (cari.email) {
    cari.email_kaynagi ||= 'Mikro cari kartı'
    cari.email_guven ||= 'dogrulanmis'
  }
  cari.email_adresleri = merged
  cari.email_adaylari = direct
    .filter((item) => item.email !== cari.email)
    .map(toPublicEvidence)
}

const missingBeforeGmail = snapshot.cariler.filter((cari) => !cari.email)
let gmailScanned = talepler.length > 0
let gmailCandidateCount = 0

// Cari koduna bağlanamamış Gmail teklif taleplerinden yalnız isim/domain kanıtı güçlü olanları
// aday üretir; otomatik ana e-posta yapmaz.
const historicalCandidates = matchHistoricalMailCandidates(talepler, missingBeforeGmail)
for (const [cariKod, candidates] of historicalCandidates) {
  const cari = currentByCode.get(cariKod)
  if (!cari) continue
  const existing = new Set((cari.email_adaylari || []).map((item) => item.email))
  for (const candidate of candidates.sort(sortEvidence).slice(0, 5)) {
    if (existing.has(candidate.email)) continue
    cari.email_adaylari.push(toPublicEvidence(candidate))
    existing.add(candidate.email)
    gmailCandidateCount++
  }
}

if (process.env.GOOGLE_SA_KEY_B64 && mailboxes.length && missingBeforeGmail.length) {
  gmailScanned = true
  const subjects = mailboxes.map((row) => clean(row.email)).filter(Boolean)
  const gmailCandidates = await scanGmailCandidates(subjects, missingBeforeGmail)

  for (const [cariKod, candidates] of gmailCandidates) {
    const cari = currentByCode.get(cariKod)
    if (!cari) continue
    const existing = new Set((cari.email_adaylari || []).map((item) => item.email))
    for (const candidate of candidates.sort(sortEvidence).slice(0, 5)) {
      if (existing.has(candidate.email)) continue
      cari.email_adaylari.push(toPublicEvidence(candidate))
      existing.add(candidate.email)
      gmailCandidateCount++
    }
  }
}

snapshot.email_ozet = {
  toplam_cari: snapshot.cariler.length,
  gonderime_hazir: snapshot.cariler.filter((cari) => cari.email).length,
  adayli: snapshot.cariler.filter((cari) => !cari.email && cari.email_adaylari?.length).length,
  eksik: snapshot.cariler.filter((cari) => !cari.email && !cari.email_adaylari?.length).length,
  gmail_tarandi: gmailScanned,
  gmail_aday_sayisi: gmailCandidateCount,
  gmail_kaynagi: process.env.GOOGLE_SA_KEY_B64
    ? 'SS geçmiş yazışmaları + Gmail readonly'
    : 'SS Supabase Gmail/IMAP geçmişi',
}
snapshot.email_enriched_at = new Date().toISOString()
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))

console.log('E-posta zenginleştirme tamamlandı:', snapshot.email_ozet)

async function scanGmailCandidates(subjects, missingCariler) {
  const result = new Map()
  for (const subject of subjects) {
    let accessToken
    try {
      accessToken = await gmailAccessToken(subject)
    } catch (error) {
      console.warn(`Gmail kutusu atlandı (${subject}):`, error instanceof Error ? error.message : error)
      continue
    }

    for (const cari of missingCariler) {
      const phrase = searchPhrase(cari.firma_adi)
      if (!phrase) continue
      try {
        const ids = await gmailSearch(accessToken, `after:2020/01/01 \"${phrase}\"`, 3)
        if (!ids.length) continue
        const accumulator = new Map()
        for (const id of ids) {
          const headers = await gmailMetadata(accessToken, id)
          for (const address of externalAddresses(headers)) {
            const score = candidateScore(cari.firma_adi, address)
            if (score < 1) continue
            const existing = accumulator.get(address.email) || {
              email: address.email,
              kaynaklar: ['Gmail yazışması'],
              guven: 'aday',
              adet: 0,
              son_tarih: null,
              eslesme_notu: `Gmail araması: ${phrase}`,
            }
            existing.adet++
            accumulator.set(address.email, existing)
          }
        }
        if (accumulator.size) result.set(cari.cari_kod, [...accumulator.values()])
      } catch (error) {
        console.warn(`Gmail araması atlandı (${cari.cari_kod}/${subject}):`, error instanceof Error ? error.message : error)
      }
    }
  }
  return result
}

function matchHistoricalMailCandidates(rows, missingCariler) {
  const result = new Map()
  for (const row of rows) {
    if (row.silindi === true) continue
    const parsed = parseAddress(row.mail_from)
    if (!parsed || isInternal(parsed.email) || isNoise(parsed.email)) continue
    const haystack = `${parsed.display} ${parsed.email.split('@')[1]?.split('.')[0] || ''} ${row.mail_subject || ''} ${row.mail_body_preview || ''}`
    const ranked = missingCariler
      .map((cari) => ({ cari, score: textMatchScore(cari.firma_adi, haystack) }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
    if (!ranked.length || (ranked[1] && ranked[0].score === ranked[1].score)) continue
    const winner = ranked[0].cari
    const list = result.get(winner.cari_kod) || []
    let candidate = list.find((item) => item.email === parsed.email)
    if (!candidate) {
      candidate = {
        email: parsed.email,
        kaynaklar: ['Gmail teklif geçmişi'],
        guven: 'aday',
        adet: 0,
        son_tarih: null,
        eslesme_notu: 'Firma adı/domain ile eşleşti; personel onayı gerekli',
      }
      list.push(candidate)
    }
    candidate.adet++
    const tarih = dateOnly(row.mail_received_at)
    if (tarih && (!candidate.son_tarih || tarih > candidate.son_tarih)) candidate.son_tarih = tarih
    result.set(winner.cari_kod, list)
  }
  return result
}

async function restAll(table, select, filters = {}) {
  const result = []
  const limit = 1000
  for (let offset = 0; ; offset += limit) {
    const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`)
    url.searchParams.set('select', select)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value)
    const response = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })
    if (!response.ok) throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`)
    const rows = await response.json()
    result.push(...rows)
    if (rows.length < limit) break
  }
  return result
}

async function gmailAccessToken(subject) {
  const serviceAccount = JSON.parse(Buffer.from(process.env.GOOGLE_SA_KEY_B64, 'base64').toString('utf8'))
  const now = Math.floor(Date.now() / 1000)
  const b64url = (value) => Buffer.from(value).toString('base64url')
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      sub: subject,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    })
  )
  const unsigned = `${header}.${claims}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key)
  const assertion = `${unsigned}.${b64url(signature)}`
  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const json = await response.json()
  if (!json.access_token) throw new Error(`token alınamadı (${response.status})`)
  return json.access_token
}

async function gmailSearch(token, query, maxResults) {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`search ${response.status}`)
  const json = await response.json()
  return (json.messages || []).map((message) => message.id)
}

async function gmailMetadata(token, id) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`)
  url.searchParams.set('format', 'metadata')
  for (const header of ['From', 'To', 'Cc', 'Subject', 'Date']) url.searchParams.append('metadataHeaders', header)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`metadata ${response.status}`)
  const json = await response.json()
  return json.payload?.headers || []
}

function externalAddresses(headers) {
  const values = headers
    .filter((header) => ['from', 'to', 'cc'].includes(String(header.name).toLowerCase()))
    .map((header) => String(header.value || ''))
  const found = new Map()
  for (const value of values) {
    const regex = /(?:(?:\"?([^\"<,]+)\"?)\s*)?<([^<>\s]+@[^<>\s]+)>|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi
    for (const match of value.matchAll(regex)) {
      const email = clean(match[2] || match[3]).toLowerCase()
      if (!validEmail(email) || isInternal(email) || isNoise(email)) continue
      found.set(email, { email, display: clean(match[1]) })
    }
  }
  return [...found.values()]
}

function candidateScore(companyName, address) {
  const companyTokens = meaningfulTokens(companyName)
  const addressTokens = meaningfulTokens(`${address.display} ${address.email.split('@')[1]?.split('.')[0] || ''}`)
  const overlap = companyTokens.filter((token) => addressTokens.includes(token))
  if (overlap.length >= 2) return 3
  if (overlap.some((token) => token.length >= 6)) return 2
  return 0
}

function textMatchScore(companyName, haystack) {
  const companyTokens = meaningfulTokens(companyName)
  const normalizedHaystack = normalize(haystack)
  const matches = companyTokens.filter((token) => normalizedHaystack.includes(token))
  if (matches.length >= 2) return 3
  if (matches.some((token) => token.length >= 7)) return 2
  return 0
}

function searchPhrase(companyName) {
  return meaningfulTokens(companyName).slice(0, 2).join(' ')
}

function meaningfulTokens(value) {
  const stop = new Set(['san', 'sanayi', 'tic', 'ticaret', 'ltd', 'sti', 'as', 'anonim', 'limited', 've', 'ithalat', 'ihracat', 'turkiye'])
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !stop.has(token))
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
}

function emails(value) {
  return [...new Set(String(value || '').split(/[;,\s]+/).map((item) => clean(item).toLowerCase()).filter(validEmail))]
}

function extractEmail(value) {
  return parseAddress(value)?.email || ''
}

function parseAddress(value) {
  const text = clean(value)
  const angle = text.match(/^(?:\"?([^\"<]+)\"?\s*)?<([^<>\s]+@[^<>\s]+)>/)
  const bare = text.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  const email = clean(angle?.[2] || bare?.[1]).toLowerCase()
  if (!validEmail(email)) return null
  return { email, display: clean(angle?.[1]) }
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isInternal(email) {
  return email.endsWith('@hidroteknik.com.tr')
}

function isNoise(email) {
  return /^(no-?reply|noreply|mailer-daemon|postmaster|bildirim|notification)@/i.test(email)
}

function clean(value) {
  return String(value || '').trim()
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null
}

function confidenceRank(value) {
  return { aday: 1, yuksek: 2, dogrulanmis: 3 }[value] || 0
}

function sortEvidence(a, b) {
  const sourceScore = (item) =>
    (item.kaynaklar.includes('SS cari kartı') ? 100 : 0) +
    (item.kaynaklar.includes('Eski teklif') ? 50 : 0) +
    (item.kaynaklar.includes('Servis kaydı') ? 40 : 0) +
    item.kaynaklar.length * 10 +
    item.adet
  return sourceScore(b) - sourceScore(a) || String(b.son_tarih || '').localeCompare(String(a.son_tarih || ''))
}

function toPublicEvidence(item) {
  return {
    email: item.email,
    kaynak: item.kaynaklar.join(' + '),
    guven: item.guven,
    adet: item.adet,
    son_tarih: item.son_tarih,
    eslesme_notu: item.eslesme_notu || null,
  }
}

function loadEnv() {
  for (const filename of ['.env.local', '.env']) {
    const envPath = path.join(root, filename)
    if (!fs.existsSync(envPath)) continue
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      let value = match[2].trim()
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1)
      }
      process.env[match[1]] = value
    }
  }
}
