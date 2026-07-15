import 'server-only'
import { readFileSync } from 'fs'
import path from 'path'
import type {
  AcikKalem,
  AgingBucket,
  AgingTotals,
  CariBakiye,
  EmailAday,
  TahsilatSnapshot,
  TelefonAday,
} from './types'
import { AGING_BUCKETS, gunFromPlanAdi } from './types'
import { mergeTestCariler } from './test-cariler'
import { createAdminClient } from './supabase/admin'
import { parsePhones } from './phone'

/**
 * Tahsilat verisi CANLI Supabase tablolarından beslenir:
 *   - `vade_takip_tahsilat`  → açık alacak evrakları (günlük snapshot, Mikro sync)
 *   - `cariler`              → firma adı, e-posta, telefon, ödeme vadesi
 *
 * İşaret kuralı ss ile aynı: bakiye>0 = alacağımız (tahsilat). Yalnızca 120* müşteriler dahil;
 * 320* tedarikçiler (fazla ödeme yüzünden borçlu görünebilir) hem Mikro sync'te hem okuma
 * tarafında hariç tutulur. ŞAHLAN (120.01.0001) ve AYGÜN SARI (120.01.4249) normal müşteridir, dahildir.
 *
 * Supabase erişilemezse (servis rolü tanımlı değil / sorgu boş) `data/tahsilat_snapshot.json`
 * yedeğine düşülür; böylece yerelde anahtarsız `npm run dev` de çalışır.
 */

const CACHE_TTL_MS = 60_000
let cache: { data: TahsilatSnapshot; at: number } | null = null

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function emptyAging(): AgingTotals {
  return Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket, 0])) as AgingTotals
}

const GECIKMIS_BUCKETS = AGING_BUCKETS.filter((bucket) => bucket !== 'Vadesi gelmemiş')

function agingBucket(gecikmeGun: number): AgingBucket {
  if (gecikmeGun <= 0) return 'Vadesi gelmemiş'
  if (gecikmeGun <= 30) return '1–30 gün'
  if (gecikmeGun <= 60) return '31–60 gün'
  if (gecikmeGun <= 90) return '61–90 gün'
  return '90+ gün'
}

function diffDays(later: string, earlier: string): number {
  return Math.round(
    (Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000
  )
}

function parseEmails(value: unknown): string[] {
  return [
    ...new Set(
      String(value || '')
        .split(/[;,\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ),
  ]
}

// ---- JSON yedeği (Supabase erişilemezse) -----------------------------------

function loadJsonSnapshot(): TahsilatSnapshot | null {
  try {
    const file = path.join(process.cwd(), 'data', 'tahsilat_snapshot.json')
    return JSON.parse(readFileSync(file, 'utf8')) as TahsilatSnapshot
  } catch {
    return null
  }
}

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
    telefon_numaralari: c.telefon_numaralari || (c.telefon ? [c.telefon] : []),
    telefon_adaylari: c.telefon_adaylari || [],
    bakiye: Number(c.bakiye) || 0,
    gecikmis_bakiye: Number(c.gecikmis_bakiye) || 0,
    odeme_vadesi: c.odeme_vadesi,
    vade_gun,
    aging: c.aging || emptyAging(),
    acik_kalemler: c.acik_kalemler || [],
  }
}

function finalizeTotals(snapshot: TahsilatSnapshot): TahsilatSnapshot {
  const cariler = [...snapshot.cariler].sort((a, b) => b.bakiye - a.bakiye)
  const aging = emptyAging()
  for (const cari of cariler) {
    for (const bucket of AGING_BUCKETS) {
      aging[bucket] = money(aging[bucket] + (cari.aging?.[bucket] || 0))
    }
  }
  return {
    ...snapshot,
    cariler,
    cari_sayisi: cariler.length,
    toplam_alacak: money(cariler.reduce((sum, cari) => sum + cari.bakiye, 0)),
    toplam_gecikmis: money(cariler.reduce((sum, cari) => sum + cari.gecikmis_bakiye, 0)),
    aging,
  }
}

function buildFromJson(): TahsilatSnapshot | null {
  const raw = loadJsonSnapshot()
  if (!raw) return null
  const base = { ...raw, cariler: (raw.cariler || []).map(normalize) }
  const merged = mergeTestCariler(base)
  return finalizeTotals({ ...merged, cariler: merged.cariler.map(normalize) })
}

/**
 * Enrichment adaylarını (Gmail/CSV taramasından gelen e-posta/telefon önerileri)
 * JSON snapshot'tan cari koduna göre bindirir. Bakiyeler canlıdan, adaylar en son
 * `npm run enrich:*` çıktısından gelir; ayrı bir aday tablosu gerektirmez.
 */
function loadAdaylarOverlay(): Map<string, { email: EmailAday[]; telefon: TelefonAday[] }> {
  const map = new Map<string, { email: EmailAday[]; telefon: TelefonAday[] }>()
  const raw = loadJsonSnapshot()
  for (const cari of raw?.cariler || []) {
    const email = cari.email_adaylari || []
    const telefon = cari.telefon_adaylari || []
    if (email.length || telefon.length) {
      map.set(cari.cari_kod, { email, telefon })
    }
  }
  return map
}

// ---- Canlı Supabase yükleyicisi --------------------------------------------

type TahsilatRow = {
  cari_kod: string
  firma_adi: string | null
  evrak_no: string | null
  belge_no: string | null
  evrak_tarihi: string | null
  vade_tarihi: string | null
  tutar: number | string | null
  temsilci: string | null
}

type AdminClient = ReturnType<typeof createAdminClient>

async function fetchLatestTahsilatDate(admin: AdminClient): Promise<string | null> {
  const { data, error } = await admin
    .from('vade_takip_tahsilat')
    .select('snapshot_tarihi')
    .order('snapshot_tarihi', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0]?.snapshot_tarihi ? String(data[0].snapshot_tarihi) : null
}

async function fetchTahsilatRows(admin: AdminClient, tarih: string): Promise<TahsilatRow[]> {
  const PAGE = 1000
  const all: TahsilatRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('vade_takip_tahsilat')
      .select('cari_kod,firma_adi,evrak_no,belge_no,evrak_tarihi,vade_tarihi,tutar,temsilci')
      .eq('snapshot_tarihi', tarih)
      // 320* = tedarikçiler (Satıcılar). Fazla ödeme yaptığımızda bize borçlu görünüp
      // yanlışlıkla tahsilat listesine düşerler; okuma tarafında da hariç tutulur.
      .not('cari_kod', 'ilike', '320%')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as TahsilatRow[]))
    if (data.length < PAGE) break
  }
  return all
}

type CariMasterRow = {
  id: string | null
  cari_kod: string
  firma_adi: string | null
  yetkili_adi: string | null
  email: string | null
  telefon: string | null
  vade_gun: number | null
  odeme_vadesi: string | null
  odeme_plani_adi: string | null
}

async function fetchCariMaster(
  admin: AdminClient,
  codes: string[]
): Promise<Map<string, CariMasterRow>> {
  const map = new Map<string, CariMasterRow>()
  const CHUNK = 200
  for (let i = 0; i < codes.length; i += CHUNK) {
    const slice = codes.slice(i, i + CHUNK)
    const { data, error } = await admin
      .from('cariler')
      .select('id,cari_kod,firma_adi,yetkili_adi,email,telefon,vade_gun,odeme_vadesi,odeme_plani_adi')
      .in('cari_kod', slice)
    if (error) throw error
    for (const row of (data as CariMasterRow[]) || []) {
      map.set(String(row.cari_kod), row)
    }
  }
  return map
}

// ---- İletişim zenginleştirme (Faz 1) ---------------------------------------
// Eksik e-posta/telefonları AYNI Supabase'deki cari'ye bağlı kaynaklardan okuma
// anında doldurur: cari_kisiler (CRM), services (servis kayıtları), yurtici_teklif
// (gönderdiğimiz teklif e-postaları) ve teklif_no ile bağlanan teklif_talep gönderenleri.
// Ayrı tablo/cron yok; günlük Mikro sync bunları ezmez, hep güncel kalır.

type ContactEnrichment = Map<string, { emails: string[]; telefonlar: string[] }>

const ENRICH_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

/** "Ad Soyad <mail@x>" gibi ham alanlardan geçerli e-postaları çıkarır; kendi alan adımızı eler. */
function extractEnrichEmails(raw: unknown): string[] {
  if (!raw) return []
  const matches = String(raw).toLowerCase().match(ENRICH_EMAIL_RE) || []
  return matches.filter((e) => !e.endsWith('@hidroteknik.com.tr'))
}

async function selectInChunks<T>(
  keys: string[],
  run: (slice: string[]) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const out: T[] = []
  const CHUNK = 150
  for (let i = 0; i < keys.length; i += CHUNK) {
    const { data, error } = await run(keys.slice(i, i + CHUNK))
    if (error) throw error
    if (Array.isArray(data)) out.push(...(data as T[]))
  }
  return out
}

async function fetchContactEnrichment(
  admin: AdminClient,
  masters: CariMasterRow[]
): Promise<ContactEnrichment> {
  const result: ContactEnrichment = new Map()
  const idToKod = new Map<string, string>()
  const cariIds: string[] = []
  const cariKods: string[] = []
  for (const m of masters) {
    if (m.id) {
      idToKod.set(m.id, m.cari_kod)
      cariIds.push(m.id)
    }
    cariKods.push(m.cari_kod)
  }

  const addEmail = (kod: string | undefined, raw: unknown) => {
    if (!kod) return
    const cur = result.get(kod) || { emails: [], telefonlar: [] }
    for (const e of extractEnrichEmails(raw)) if (!cur.emails.includes(e)) cur.emails.push(e)
    result.set(kod, cur)
  }
  const addTel = (kod: string | undefined, raw: unknown) => {
    if (!kod || raw == null || !String(raw).trim()) return
    const cur = result.get(kod) || { emails: [], telefonlar: [] }
    cur.telefonlar.push(String(raw))
    result.set(kod, cur)
  }

  // 1) cari_kisiler (cari_id) — CRM kişi kartları
  if (cariIds.length) {
    const kisiler = await selectInChunks<{ cari_id: string; email: string | null; telefon: string | null }>(
      cariIds,
      (slice) => admin.from('cari_kisiler').select('cari_id,email,telefon').in('cari_id', slice)
    )
    for (const r of kisiler) {
      const kod = idToKod.get(String(r.cari_id))
      addEmail(kod, r.email)
      addTel(kod, r.telefon)
    }

    // 2) services (cari_id) — servis kayıtlarındaki müşteri/teslim iletişimi
    const services = await selectInChunks<{
      cari_id: string
      customer_email: string | null
      customer_phone: string | null
      teslim_alan_telefon: string | null
    }>(cariIds, (slice) =>
      admin
        .from('services')
        .select('cari_id,customer_email,customer_phone,teslim_alan_telefon')
        .in('cari_id', slice)
    )
    for (const r of services) {
      const kod = idToKod.get(String(r.cari_id))
      addEmail(kod, r.customer_email)
      addTel(kod, r.customer_phone)
      addTel(kod, r.teslim_alan_telefon)
    }
  }

  // 3) yurtici_teklif (cari_kod) — gönderdiğimiz teklif e-postaları + teklif_no eşlemesi
  const teklifNoToKod = new Map<string, string>()
  if (cariKods.length) {
    const yts = await selectInChunks<{ cari_kod: string; musteri_mail: string | null; teklif_no: string | null }>(
      cariKods,
      (slice) => admin.from('yurtici_teklif').select('cari_kod,musteri_mail,teklif_no').in('cari_kod', slice)
    )
    for (const r of yts) {
      addEmail(String(r.cari_kod), r.musteri_mail)
      const tn = String(r.teklif_no || '').trim()
      if (tn) teklifNoToKod.set(tn, String(r.cari_kod))
    }
  }

  // 4) teklif_talep (mail_from) — teklif_no üzerinden cari'ye bağlanan gelen teklif e-postaları
  const teklifNos = [...teklifNoToKod.keys()]
  if (teklifNos.length) {
    const talepler = await selectInChunks<{ teklif_no: string | null; mail_from: string | null }>(
      teklifNos,
      (slice) => admin.from('teklif_talep').select('teklif_no,mail_from').in('teklif_no', slice)
    )
    for (const r of talepler) {
      addEmail(teklifNoToKod.get(String(r.teklif_no || '').trim()), r.mail_from)
    }
  }

  return result
}

async function buildFromSupabase(): Promise<TahsilatSnapshot | null> {
  let admin: AdminClient
  try {
    admin = createAdminClient()
  } catch {
    return null // servis rolü tanımlı değil → JSON yedeğine düş
  }

  const snapshotTarihi = await fetchLatestTahsilatDate(admin)
  if (!snapshotTarihi) return null

  const rows = await fetchTahsilatRows(admin, snapshotTarihi)
  if (!rows.length) return null

  const grouped = new Map<string, TahsilatRow[]>()
  for (const row of rows) {
    const cariKod = String(row.cari_kod || '').trim()
    if (!cariKod) continue
    const list = grouped.get(cariKod)
    if (list) list.push(row)
    else grouped.set(cariKod, [row])
  }

  const cariMaster = await fetchCariMaster(admin, [...grouped.keys()])
  const adaylar = loadAdaylarOverlay()
  const iletisim = await fetchContactEnrichment(admin, [...cariMaster.values()])

  const cariler: CariBakiye[] = []
  for (const [cariKod, evraklar] of grouped) {
    const master = cariMaster.get(cariKod)
    const aging = emptyAging()
    const acikKalemler: AcikKalem[] = []
    let bakiye = 0

    for (const row of evraklar) {
      const tutar = money(Number(row.tutar) || 0)
      if (tutar <= 0) continue
      bakiye = money(bakiye + tutar)
      const vadeTarihi = row.vade_tarihi ? String(row.vade_tarihi) : null
      const evrakTarihi = row.evrak_tarihi ? String(row.evrak_tarihi) : null
      const gecikmeGun = vadeTarihi ? diffDays(snapshotTarihi, vadeTarihi) : 0
      const bucket = agingBucket(gecikmeGun)
      aging[bucket] = money(aging[bucket] + tutar)
      acikKalemler.push({
        evrak_no: row.evrak_no ? String(row.evrak_no) : null,
        belge_no: row.belge_no ? String(row.belge_no) : null,
        evrak_tarihi: evrakTarihi,
        vade_tarihi: vadeTarihi,
        gecikme_gun: gecikmeGun,
        aging_bucket: bucket,
        tutar,
        temsilci: row.temsilci ? String(row.temsilci).trim() || null : null,
      })
    }

    if (bakiye < 1) continue

    acikKalemler.sort((a, b) =>
      (a.vade_tarihi || '9999').localeCompare(b.vade_tarihi || '9999')
    )

    // Master (cari kartı) önce; eksikleri Faz-1 zenginleştirme kaynaklarıyla tamamla.
    const enr = iletisim.get(cariKod)
    const masterEmails = parseEmails(master?.email)
    const masterPhones = parsePhones(master?.telefon)
    const emails = parseEmails([master?.email, ...(enr?.emails || [])].filter(Boolean).join(';'))
    const phones = parsePhones([master?.telefon, ...(enr?.telefonlar || [])].filter(Boolean).join(';'))
    const odemeVadesi = master?.odeme_vadesi || master?.odeme_plani_adi || null
    const vadeGun =
      master?.vade_gun != null && master.vade_gun > 0
        ? master.vade_gun
        : gunFromPlanAdi(odemeVadesi) ?? master?.vade_gun ?? null
    const overlay = adaylar.get(cariKod)

    cariler.push({
      cari_kod: cariKod,
      firma_adi: (master?.firma_adi || evraklar[0]?.firma_adi || cariKod).trim(),
      email: emails[0] || null,
      email_adresleri: emails,
      email_kaynagi: emails.length
        ? masterEmails.length
          ? 'SS cari kartı'
          : 'Teklif/servis/kişi kaydı'
        : null,
      email_guven: emails.length ? 'dogrulanmis' : null,
      email_adaylari: overlay?.email || [],
      telefon: phones[0] || null,
      telefon_numaralari: phones,
      telefon_kaynagi: phones.length
        ? masterPhones.length
          ? 'SS cari kartı'
          : 'Teklif/servis/kişi kaydı'
        : null,
      telefon_guven: phones.length ? 'dogrulanmis' : null,
      telefon_adaylari: overlay?.telefon || [],
      bakiye,
      gecikmis_bakiye: money(
        GECIKMIS_BUCKETS.reduce((sum, bucket) => sum + aging[bucket], 0)
      ),
      odeme_vadesi: odemeVadesi,
      vade_gun: vadeGun,
      aging,
      acik_kalemler: acikKalemler,
    })
  }

  const snapshot: TahsilatSnapshot = {
    sourced_at: new Date().toISOString(),
    source: 'Supabase · vade_takip_tahsilat (canlı)',
    snapshot_tarihi: snapshotTarihi,
    note: 'Canlı Supabase: vade_takip_tahsilat açık alacak evrakları + cariler kartı. Bakiye>0 alacağımız; yalnızca 120* müşteriler, 320* tedarikçiler hariç. ŞAHLAN/AYGÜN dahil.',
    cari_sayisi: cariler.length,
    toplam_alacak: 0,
    toplam_gecikmis: 0,
    aging: emptyAging(),
    cariler,
  }

  return finalizeTotals(mergeTestCariler(snapshot))
}

// ---- Genel API -------------------------------------------------------------

export async function loadSnapshot(): Promise<TahsilatSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data

  let data: TahsilatSnapshot | null = null
  try {
    data = await buildFromSupabase()
  } catch (cause) {
    console.error(
      '[data] Supabase tahsilat verisi yüklenemedi, JSON yedeğine düşülüyor:',
      cause instanceof Error ? cause.message : cause
    )
  }
  if (!data) data = buildFromJson()
  if (!data) {
    throw new Error('Tahsilat verisi yüklenemedi (Supabase ve JSON yedeği boş).')
  }

  cache = { data, at: Date.now() }
  return data
}

export function clearSnapshotCache() {
  cache = null
}

export async function getCari(cariKod: string): Promise<CariBakiye | undefined> {
  return (await loadSnapshot()).cariler.find((c) => c.cari_kod === cariKod)
}

export async function searchCariler(q: string): Promise<CariBakiye[]> {
  const snap = await loadSnapshot()
  const term = q.trim().toLocaleLowerCase('tr')
  if (!term) return snap.cariler
  return snap.cariler.filter(
    (c) =>
      c.firma_adi.toLocaleLowerCase('tr').includes(term) ||
      c.cari_kod.toLocaleLowerCase('tr').includes(term)
  )
}
