import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { logEmailYanit } from '@/lib/cari-yanitlar'
import { sendMail } from '@/lib/mail'
import { formatDate } from '@/lib/mutabakat'
import { verifyMutabakatToken } from '@/lib/mutabakat-token'
import { formatTL } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
])

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      aciklama?: string
      iletisim?: string
      screenshotBase64?: string | null
      website?: string
    }

    if (body.website) return NextResponse.json({ success: true })

    const payload = verifyMutabakatToken(String(body.token || ''))
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Bağlantı geçersiz veya süresi dolmuş.' }, { status: 401 })
    }

    const cari = getCari(payload.cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari kaydı bulunamadı.' }, { status: 404 })
    }

    const aciklama = String(body.aciklama || '').trim()
    const iletisim = String(body.iletisim || '').trim()
    if (aciklama.length < 10 || aciklama.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Açıklama 10–5000 karakter arasında olmalıdır.' },
        { status: 400 }
      )
    }
    if (iletisim.length > 250) {
      return NextResponse.json({ success: false, error: 'İletişim bilgisi çok uzun.' }, { status: 400 })
    }

    const attachments = parseScreenshot(body.screenshotBase64)
    const recipients = String(process.env.MUTABAKAT_BILDIRIM_TO || '')
      .split(/[,;]/)
      .map((email) => email.trim())
      .filter(Boolean)
    if (!recipients.length) throw new Error('Mutabakat bildirim alıcısı yapılandırılmadı')

    const safeAciklama = escapeHtml(aciklama).replaceAll('\n', '<br>')
    const safeIletisim = escapeHtml(iletisim || 'Belirtilmedi')
    const subject = `MUTABAKAT İTİRAZI — ${cari.firma_adi} (${cari.cari_kod})`
    const html = `<!doctype html>
<html lang="tr"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.1)">
    <div style="padding:18px 24px;background:#b42318;color:#fff;font-weight:700">Cari hesap mutabakatı — fark/itiraz bildirimi</div>
    <div style="padding:24px">
      <table width="100%" cellspacing="0" cellpadding="6" style="font-size:13px;border-collapse:collapse">
        <tr><td style="color:#64748b;width:150px">Firma</td><td><strong>${escapeHtml(cari.firma_adi)}</strong></td></tr>
        <tr><td style="color:#64748b">Cari kod</td><td>${escapeHtml(cari.cari_kod)}</td></tr>
        <tr><td style="color:#64748b">Mutabakat tarihi</td><td>${escapeHtml(formatDate(payload.snapshotTarihi))}</td></tr>
        <tr><td style="color:#64748b">Bildirilen bakiye</td><td><strong>${escapeHtml(formatTL(payload.bakiye))}</strong></td></tr>
        <tr><td style="color:#64748b">İletişim</td><td>${safeIletisim}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca">
        <div style="font-size:11px;text-transform:uppercase;color:#991b1b;font-weight:700">Fark / itiraz açıklaması</div>
        <div style="margin-top:8px;font-size:14px;line-height:1.7">${safeAciklama}</div>
      </div>
      ${attachments.length ? '<p style="margin:18px 0 0;font-size:13px;color:#64748b">Ekran görüntüsü ektedir.</p>' : ''}
    </div>
  </div>
</body></html>`

    const text = `CARİ HESAP MUTABAKATI — FARK/İTİRAZ

Firma: ${cari.firma_adi}
Cari kod: ${cari.cari_kod}
Mutabakat tarihi: ${formatDate(payload.snapshotTarihi)}
Bildirilen bakiye: ${formatTL(payload.bakiye)}
İletişim: ${iletisim || 'Belirtilmedi'}

Açıklama:
${aciklama}`

    await sendMail({ to: recipients, subject, html, text, attachments })

    await logEmailYanit({
      cariKod: cari.cari_kod,
      aciklama,
      iletisim: iletisim || null,
      konu: subject,
    })

    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[mutabakat-itiraz]', cause instanceof Error ? cause.message : cause)
    return NextResponse.json(
      { success: false, error: 'Bildirim şu anda iletilemedi. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

function parseScreenshot(value?: string | null) {
  if (!value) return []
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error('Geçersiz ekran görüntüsü')
  const contentType = match[1]!
  const content = match[2]!
  const extension = ALLOWED_IMAGE_TYPES.get(contentType)
  if (!extension) throw new Error('Desteklenmeyen görsel biçimi')
  const byteLength = Buffer.byteLength(content, 'base64')
  if (byteLength <= 0 || byteLength > 4 * 1024 * 1024) throw new Error('Ekran görüntüsü çok büyük')
  return [{ filename: `mutabakat-itiraz.${extension}`, content, contentType }]
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
