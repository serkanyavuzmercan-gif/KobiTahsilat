import { NextResponse } from 'next/server'
import crypto from 'crypto'
import https from 'https'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function mikroHash(sifreGun: string) {
  const today = new Date().toISOString().split('T')[0]
  return crypto.createHash('md5').update(`${today} ${sifreGun}`).digest('hex')
}

function mikroPost(baseUrl: string, bodyObj: unknown): Promise<any> {
  const body = JSON.stringify(bodyObj)
  const u = new URL(baseUrl.replace(/\/$/, '') + '/SqlVeriOkuV2')
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 45000,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c as Buffer))
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
      reject(new Error('Mikro API timeout (muhtemelen LAN-only, buluttan erişilemiyor)'))
    })
    req.write(body)
    req.end()
  })
}

function normalizeMobile(input: unknown): string | null {
  let d = String(input || '').replace(/[^0-9+]/g, '')
  d = d.replace(/^\+/, '').replace(/\D/g, '')
  if (!d) return null
  let ten: string | null = null
  if (d.startsWith('90') && d.length === 12) ten = d.slice(2)
  else if (d.startsWith('0') && d.length === 11) ten = d.slice(1)
  else if (d.length === 10) ten = d
  if (!ten || !/^5[0-9]{9}$/.test(ten)) return null
  if (/^(.)\1{9}$/.test(ten)) return null
  return `+90${ten}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  if (!process.env.ENRICH_SECRET || searchParams.get('secret') !== process.env.ENRICH_SECRET) {
    return NextResponse.json({ success: false, error: 'Yetkisiz.' }, { status: 403 })
  }

  const base = process.env.MIKRO_BASE_URL
  if (!base) return NextResponse.json({ success: false, error: 'MIKRO_BASE_URL yok.' }, { status: 503 })

  const auth = {
    ApiKey: process.env.MIKRO_API_KEY,
    FirmaKodu: process.env.MIKRO_FIRMA_KODU,
    CalismaYili: Number(process.env.MIKRO_CALISMA_YILI),
    KullaniciKodu: process.env.MIKRO_KULLANICI_KODU,
    Sifre: mikroHash(process.env.MIKRO_SIFRE_GUN || ''),
  }

  // Muhatap cep numaraları: CARI_HESAP_YETKILILERI.mye_cep_telno (asıl cep kaynağı).
  const sql = `
    SELECT LTRIM(RTRIM(mye_cari_kod)) AS cari_kod,
           ISNULL(mye_cep_telno,'') AS cep,
           LTRIM(RTRIM(ISNULL(mye_isim,'')+' '+ISNULL(mye_soyisim,''))) AS ad_soyad
    FROM CARI_HESAP_YETKILILERI WITH (NOLOCK)
    WHERE mye_cari_kod LIKE '120%' AND LEN(LTRIM(RTRIM(ISNULL(mye_cep_telno,'')))) > 0`

  let res: any
  try {
    res = await mikroPost(base, { Mikro: auth, SQLSorgu: sql })
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : 'Mikro çağrısı başarısız.' },
      { status: 502 }
    )
  }
  if (res?.result?.[0]?.IsError) {
    return NextResponse.json({ success: false, error: String(res.result[0].ErrorMessage) }, { status: 502 })
  }
  const rows: any[] = res?.result?.[0]?.Data?.[0]?.SQLResult1 || []

  // (cari_kod -> {phone -> ad_soyad}) normalize + dedupe
  const perCari = new Map<string, Map<string, string>>()
  for (const r of rows) {
    const kod = String(r.cari_kod || '').trim()
    const phone = normalizeMobile(r.cep)
    if (!kod || !phone) continue
    const m = perCari.get(kod) || new Map<string, string>()
    if (!m.has(phone)) m.set(phone, String(r.ad_soyad || '').trim() || 'Mikro yetkili')
    perCari.set(kod, m)
  }

  const admin = createAdminClient()
  const kodlar = [...perCari.keys()]
  // cari_kod -> id
  const idMap = new Map<string, string>()
  for (let i = 0; i < kodlar.length; i += 200) {
    const { data } = await admin.from('cariler').select('id,cari_kod').in('cari_kod', kodlar.slice(i, i + 200))
    for (const c of data || []) idMap.set(String(c.cari_kod), String(c.id))
  }

  const inserts: Array<{ cari_id: string; ad_soyad: string; unvan: string; telefon: string; notlar: string }> = []
  for (const [kod, phones] of perCari) {
    const cid = idMap.get(kod)
    if (!cid) continue
    for (const [phone, ad] of phones) {
      inserts.push({
        cari_id: cid,
        ad_soyad: ad,
        unvan: 'mikro-yetkili',
        telefon: phone,
        notlar: 'Mikro CARI_HESAP_YETKILILERI cep',
      })
    }
  }

  let eklenen = 0
  for (let i = 0; i < inserts.length; i += 200) {
    const chunk = inserts.slice(i, i + 200)
    // aynı (cari_id, telefon) varsa atla
    const { data: mevcut } = await admin
      .from('cari_kisiler')
      .select('cari_id,telefon')
      .in('cari_id', chunk.map((c) => c.cari_id))
    const set = new Set((mevcut || []).map((m) => `${m.cari_id}|${String(m.telefon || '').trim()}`))
    const yeni = chunk.filter((c) => !set.has(`${c.cari_id}|${c.telefon}`))
    if (yeni.length) {
      const { error } = await admin.from('cari_kisiler').insert(yeni)
      if (!error) eklenen += yeni.length
    }
  }

  return NextResponse.json({
    success: true,
    mikro_satir: rows.length,
    cari_sayisi: perCari.size,
    aday_numara: inserts.length,
    eklenen,
  })
}
