import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { logMutabakatOnay } from '@/lib/cari-yanitlar'
import { sendMail } from '@/lib/mail'
import { formatDate } from '@/lib/mutabakat'
import { verifyMutabakatToken } from '@/lib/mutabakat-token'
import { formatTL } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      aciklama?: string
      iletisim?: string
      website?: string
    }

    if (body.website) return NextResponse.json({ success: true })

    const payload = verifyMutabakatToken(String(body.token || ''))
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Bağlantı geçersiz veya süresi dolmuş.' },
        { status: 401 }
      )
    }

    const cari = await getCari(payload.cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari kaydı bulunamadı.' }, { status: 404 })
    }

    const aciklama = String(body.aciklama || '').trim().slice(0, 2000)
    const iletisim = String(body.iletisim || '').trim().slice(0, 250)

    // Kayıt (Sonuçlar sekmesi + geçmiş)
    await logMutabakatOnay({
      cariKod: cari.cari_kod,
      aciklama: aciklama || null,
      iletisim: iletisim || null,
    })

    // Serkan bey'e bildirim (tek tek kontrol için)
    const recipients = String(process.env.MUTABAKAT_BILDIRIM_TO || '')
      .split(/[,;]/)
      .map((email) => email.trim())
      .filter(Boolean)

    if (recipients.length) {
      const subject = `MUTABAKAT ONAYI — ${cari.firma_adi} (${cari.cari_kod})`
      const safeAciklama = aciklama ? escapeHtml(aciklama).replaceAll('\n', '<br>') : '—'
      const safeIletisim = escapeHtml(iletisim || 'Belirtilmedi')
      const html = `<!doctype html>
<html lang="tr"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.1)">
    <div style="padding:18px 24px;background:#16865a;color:#fff;font-weight:700">Cari hesap mutabakatı — ONAY (mutabıkız)</div>
    <div style="padding:24px">
      <table width="100%" cellspacing="0" cellpadding="6" style="font-size:13px;border-collapse:collapse">
        <tr><td style="color:#64748b;width:150px">Firma</td><td><strong>${escapeHtml(cari.firma_adi)}</strong></td></tr>
        <tr><td style="color:#64748b">Cari kod</td><td>${escapeHtml(cari.cari_kod)}</td></tr>
        <tr><td style="color:#64748b">Mutabakat tarihi</td><td>${escapeHtml(formatDate(payload.snapshotTarihi))}</td></tr>
        <tr><td style="color:#64748b">Onaylanan bakiye</td><td><strong>${escapeHtml(formatTL(payload.bakiye))}</strong></td></tr>
        <tr><td style="color:#64748b">İletişim</td><td>${safeIletisim}</td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0">
        <div style="font-size:11px;text-transform:uppercase;color:#065f46;font-weight:700">Müşteri notu</div>
        <div style="margin-top:8px;font-size:14px;line-height:1.7">${safeAciklama}</div>
      </div>
    </div>
  </div>
</body></html>`
      const text = `CARİ HESAP MUTABAKATI — ONAY (mutabıkız)

Firma: ${cari.firma_adi}
Cari kod: ${cari.cari_kod}
Mutabakat tarihi: ${formatDate(payload.snapshotTarihi)}
Onaylanan bakiye: ${formatTL(payload.bakiye)}
İletişim: ${iletisim || 'Belirtilmedi'}

Not: ${aciklama || '—'}`

      await sendMail({ to: recipients, subject, html, text })
    }

    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[mutabakat-onay]', cause instanceof Error ? cause.message : cause)
    return NextResponse.json(
      { success: false, error: 'Onay şu anda iletilemedi. Lütfen daha sonra tekrar deneyin.' },
      { status: 500 }
    )
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
