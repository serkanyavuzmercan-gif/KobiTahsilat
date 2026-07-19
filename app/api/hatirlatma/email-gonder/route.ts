import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { loadSnapshot } from '@/lib/data'
import { normalizeEmail } from '@/lib/email'
import { toErrorMessage } from '@/lib/errors'
import { buildHatirlatmaEmail } from '@/lib/automation/email-template'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { HATIRLATMA_LOG_KAYNAK, ODEME_TALEP_EMAIL_TIP } from '@/lib/hatirlatma-log'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { olusturVeKaydetOdemeLink } from '@/lib/odeme-link'
import { sendMail } from '@/lib/mail'
import { renderOdemeTalepPdf } from '@/lib/odeme-talep-pdf'

export const dynamic = 'force-dynamic'

function sendEnabled() {
  return process.env.MUTABAKAT_SEND_ENABLED !== 'false'
}

export async function POST(request: Request) {
  try {
    if (!sendEnabled()) {
      return NextResponse.json(
        { success: false, error: 'E-posta gönderimi şu anda kapalı.' },
        { status: 403 }
      )
    }

    const user = await requireAuthUser()
    const body = (await request.json()) as {
      cariKod?: string
      messageBody?: string
      recipients?: string[]
    }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }
    const customBody = typeof body.messageBody === 'string' ? body.messageBody.trim() : ''
    if (customBody.length > 8000) {
      return NextResponse.json(
        { success: false, error: 'Mesaj metni çok uzun.' },
        { status: 400 }
      )
    }

    const cari = await loadHatirlatmaCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    if (!cari.email_adresleri.length) {
      return NextResponse.json(
        { success: false, error: 'Gönderim için doğrulanmış alıcı e-postası gerekli.' },
        { status: 400 }
      )
    }
    // ASLA tüm adreslere birden gönderme. Seçilen alt küme; seçim yoksa yalnız VARSAYILAN (ilk) adres.
    // Kayıtlı adresler VEYA elle girilen geçerli e-postalar kabul edilir (garbage elenir).
    const istenenAlicilar = Array.isArray(body.recipients) ? body.recipients.map(String) : []
    const secilenAlicilar = istenenAlicilar
      .map((e) => (cari.email_adresleri.includes(e) ? e : normalizeEmail(e)))
      .filter((e): e is string => Boolean(e))
    const alicilar = secilenAlicilar.length
      ? [...new Set(secilenAlicilar)]
      : [cari.email_adresleri[0]]

    const snapshot = await loadSnapshot()
    // PayTR ödeme linki (gecikmiş tutar) → mailde "Ödeme yapmak için tıklayın" düğmesi. Hata → null.
    const odeme = await olusturVeKaydetOdemeLink({
      cariKod: cari.cari_kod,
      firmaAdi: cari.firma_adi,
      cariEmail: cari.email_adresleri[0] || null,
      amountKurus: Math.round(cari.gecikmis_bakiye * 100),
      userId: user.id,
    })
    const email = buildHatirlatmaEmail(cari, snapshot.snapshot_tarihi, customBody, odeme?.kisaLink)
    // Gönderen sabit: Gmail (GMAIL_SENDER = serkan.mercan@). Yanıtlar da aynı kutuya döner.
    const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
    const sentAt = new Date().toISOString()

    // Vadesi geçmiş fatura dökümünü PDF olarak ekle.
    let attachments: Array<{ filename: string; content: string; contentType: string }> | undefined
    try {
      const pdfBytes = await renderOdemeTalepPdf(cari, snapshot.snapshot_tarihi)
      attachments = [
        {
          filename: `odeme-talebi-${cari.cari_kod}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
          contentType: 'application/pdf',
        },
      ]
    } catch (pdfError) {
      // PDF üretilemezse e-postayı ek olmadan yine de gönder (metin + link mevcut).
      console.error('[hatirlatma-email-pdf]', pdfError)
    }

    const result = await sendMail({
      to: alicilar,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments,
    })

    const logResult = await insertMailGonderimLog({
      mail_to: alicilar.join('; '),
      mail_from: from,
      subject: email.subject,
      body_preview: `${cari.firma_adi} ödeme talebi (e-posta) gönderildi`,
      kaynak: HATIRLATMA_LOG_KAYNAK,
      ilgili_id: cari.cari_kod,
      ilgili_tip: ODEME_TALEP_EMAIL_TIP,
      sent_at: sentAt,
      gonderen_user_id: user.id,
    })
    if (!logResult.ok) {
      console.error('[hatirlatma-email-log]', logResult.error)
    }

    return NextResponse.json({
      success: true,
      message: `Ödeme talebi e-postası ${alicilar.join(', ')} adresine gönderildi.`,
      sentAt,
      from,
      providerId: result?.id || null,
    })
  } catch (cause) {
    console.error('[hatirlatma-email-gonder]', cause)
    const message = toErrorMessage(cause, 'Ödeme talebi e-postası gönderilemedi.')
    const status = message.includes('Oturum')
      ? 401
      : message.includes('yapılandır')
        ? 503
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
