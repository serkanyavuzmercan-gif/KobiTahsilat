import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { loadSnapshot } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import { buildHatirlatmaMessage } from '@/lib/hatirlatma'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { HATIRLATMA_LOG_KAYNAK, WHATSAPP_SEND_TIP } from '@/lib/hatirlatma-log'
import { formatPhoneDisplay, formatPhoneWhatsApp, isMobileTurkey } from '@/lib/phone'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { hatirlatmaDeliveryHint, sendHatirlatmaWhatsApp } from '@/lib/hatirlatma-whatsapp'
import { whatsAppBotEnabled } from '@/lib/whatsapp-kuyruk'
import { WHATSAPP_SENDER_LABEL } from '@/lib/whatsapp-constants'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    if (!whatsAppBotEnabled()) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp gönderimi şu anda kapalı.' },
        { status: 403 }
      )
    }

    const user = await requireAuthUser()
    const body = (await request.json()) as { cariKod?: string; messageBody?: string }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }

    const cari = await loadHatirlatmaCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    if (!cari.telefon) {
      return NextResponse.json(
        { success: false, error: 'Gönderim için kayıtlı cep telefonu gerekli.' },
        { status: 400 }
      )
    }
    if (!isMobileTurkey(cari.telefon)) {
      return NextResponse.json(
        {
          success: false,
          error: `WhatsApp için cep telefonu girin. Kayıtlı numara: ${formatPhoneDisplay(cari.telefon)}`,
        },
        { status: 400 }
      )
    }

    const snapshot = await loadSnapshot()
    const defaultMessage = buildHatirlatmaMessage(cari, snapshot.snapshot_tarihi)
    const customBody = typeof body.messageBody === 'string' ? body.messageBody.trim() : ''
    const messageBody = customBody || defaultMessage.body

    if (messageBody.length === 0) {
      return NextResponse.json({ success: false, error: 'Mesaj metni boş olamaz.' }, { status: 400 })
    }
    if (messageBody.length > 4096) {
      return NextResponse.json(
        { success: false, error: 'Mesaj en fazla 4096 karakter olabilir.' },
        { status: 400 }
      )
    }

    const sentAt = new Date().toISOString()

    // Baileys kuyruğuna DM olarak ekle (ofis botu gönderir).
    const result = await sendHatirlatmaWhatsApp({
      to: formatPhoneWhatsApp(cari.telefon),
      cariKod: cari.cari_kod,
      body: messageBody,
      cari,
    })

    // Gönderim geçmişi: kuyruk id'sini body_preview'a JSON olarak sakla (durum korelasyonu için).
    const logResult = await insertMailGonderimLog({
      mail_to: cari.telefon,
      subject: defaultMessage.ozet,
      body_preview: JSON.stringify({ kuyruk_id: result.kuyrukId, mesaj: messageBody.slice(0, 200) }),
      kaynak: HATIRLATMA_LOG_KAYNAK,
      ilgili_id: cari.cari_kod,
      ilgili_tip: WHATSAPP_SEND_TIP,
      sent_at: sentAt,
      gonderen_user_id: user.id,
    })
    if (!logResult.ok) {
      console.error('[hatirlatma-whatsapp-log]', logResult.error)
    }

    const logWarning = logResult.ok
      ? ''
      : ' (Kuyruğa alındı; gönderim geçmişi kaydı yazılamadı.)'

    return NextResponse.json({
      success: true,
      message: `WhatsApp mesajı kuyruğa alındı → ${formatPhoneDisplay(cari.telefon)}. Gönderen: ${WHATSAPP_SENDER_LABEL}.${logWarning}`,
      sentAt,
      kuyrukId: result.kuyrukId,
      jid: result.jid,
      deliveryHint: hatirlatmaDeliveryHint(),
      gonderimSayisi: cari.whatsapp_gonderim_sayisi + (logResult.ok ? 1 : 0),
      logKaydedildi: logResult.ok,
    })
  } catch (cause) {
    console.error('[hatirlatma-whatsapp-gonder]', cause)
    const message = toErrorMessage(cause, 'WhatsApp mesajı gönderilemedi.')
    const status = message.includes('Oturum')
      ? 401
      : message.includes('yapılandır')
        ? 503
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
