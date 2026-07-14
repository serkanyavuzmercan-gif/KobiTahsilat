import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { MAIL_LOG_KAYNAK } from '@/lib/mutabakat-log'
import { loadSnapshot } from '@/lib/data'
import { sendMail } from '@/lib/mail'
import {
  defaultSenderId,
  formatMailFrom,
  getMailSenderById,
  listMailSenders,
} from '@/lib/mail-senders'
import { buildMutabakatEmail } from '@/lib/mutabakat'
import { loadMutabakatCari } from '@/lib/mutabakat-data'
import { createMutabakatToken } from '@/lib/mutabakat-token'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function sendEnabled() {
  return process.env.MUTABAKAT_SEND_ENABLED !== 'false'
}

export async function POST(request: Request) {
  try {
    if (!sendEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Mutabakat gönderimi şu anda kapalı.' },
        { status: 403 }
      )
    }

    const user = await requireAuthUser()
    const body = (await request.json()) as { cariKod?: string; senderId?: string }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }

    const cari = await loadMutabakatCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    if (!cari.email_adresleri.length) {
      return NextResponse.json(
        { success: false, error: 'Gönderim için doğrulanmış alıcı e-postası gerekli.' },
        { status: 400 }
      )
    }
    if (cari.mutabakat_gonderim_engelli) {
      return NextResponse.json(
        {
          success: false,
          error: 'Son gönderimden sonra 8 iş günü dolmadan tekrar gönderilemez.',
        },
        { status: 409 }
      )
    }

    const senders = await listMailSenders(user.id)
    const senderId = body.senderId || defaultSenderId(senders)
    const sender = senderId ? await getMailSenderById(user.id, senderId) : null
    if (!sender) {
      return NextResponse.json(
        { success: false, error: 'Gönderici e-posta adresi seçilmedi. Önce ayarlardan bağlayın.' },
        { status: 400 }
      )
    }

    const snapshot = loadSnapshot()
    const token = createMutabakatToken(cari.cari_kod, snapshot.snapshot_tarihi, cari.bakiye)
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobi-tahsilat.vercel.app').replace(
      /\/$/,
      ''
    )
    const email = buildMutabakatEmail(cari, snapshot.snapshot_tarihi, {
      itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
    })
    const from = formatMailFrom(sender.email, sender.ad_soyad)
    const sentAt = new Date().toISOString()

    const result = await sendMail({
      from,
      to: cari.email_adresleri,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: user.email || undefined,
    })

    const admin = createAdminClient()
    const logRow: Record<string, unknown> = {
      mail_to: cari.email_adresleri.join('; '),
      mail_from: from,
      subject: email.subject,
      body_preview: `${cari.firma_adi} mutabakatı gönderildi`,
      kaynak: MAIL_LOG_KAYNAK,
      ilgili_id: cari.cari_kod,
      ilgili_tip: 'mutabakat',
      sent_at: sentAt,
      gonderen_user_id: user.id,
    }

    const { error: logError } = await admin.from('mail_gonderim_log').insert(logRow)
    if (logError) {
      console.error('[mutabakat-gonder-log]', logError.message)
      // Gönderim başarılı olsa bile log hatasını yumuşat; istemciye başarı döneriz.
    }

    return NextResponse.json({
      success: true,
      message: `Mutabakat e-postası ${cari.email_adresleri.join(', ')} adresine gönderildi.`,
      sentAt,
      from,
      providerId: result?.id || null,
    })
  } catch (cause) {
    console.error('[mutabakat-gonder]', cause)
    const message = toErrorMessage(cause, 'Mutabakat gönderilemedi.')
    const status = message.includes('Oturum')
      ? 401
      : message.includes('yapılandır')
        ? 503
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
