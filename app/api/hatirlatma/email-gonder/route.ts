import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { loadSnapshot } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import { buildHatirlatmaEmail } from '@/lib/automation/email-template'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { HATIRLATMA_LOG_KAYNAK, ODEME_TALEP_EMAIL_TIP } from '@/lib/hatirlatma-log'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { sendMail } from '@/lib/mail'

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
    const body = (await request.json()) as { cariKod?: string }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
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

    const snapshot = await loadSnapshot()
    const email = buildHatirlatmaEmail(cari, snapshot.snapshot_tarihi)
    // Gönderen sabit: Gmail (GMAIL_SENDER = serkan.mercan@). Yanıtlar da aynı kutuya döner.
    const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
    const sentAt = new Date().toISOString()

    const result = await sendMail({
      to: cari.email_adresleri,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    const logResult = await insertMailGonderimLog({
      mail_to: cari.email_adresleri.join('; '),
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
      message: `Ödeme talebi e-postası ${cari.email_adresleri.join(', ')} adresine gönderildi.`,
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
