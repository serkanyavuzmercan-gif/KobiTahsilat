import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { loadSnapshot } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import { buildHatirlatmaMessage } from '@/lib/hatirlatma'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { HATIRLATMA_LOG_KAYNAK, WHATSAPP_SEND_TIP } from '@/lib/hatirlatma-log'
import {
  formatPhoneDisplay,
  formatPhoneWhatsApp,
  isMobileTurkey,
  normalizePhone,
} from '@/lib/phone'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { hatirlatmaDeliveryHint, sendHatirlatmaWhatsApp } from '@/lib/hatirlatma-whatsapp'
import { whatsAppBotEnabled } from '@/lib/whatsapp-kuyruk'
import { WHATSAPP_SENDER_LABEL } from '@/lib/whatsapp-constants'

export const dynamic = 'force-dynamic'

type GonderimSonuc = {
  telefon: string
  kuyrukId?: string
  jid?: string
  hata?: string
}

export async function POST(request: Request) {
  try {
    if (!whatsAppBotEnabled()) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp gönderimi şu anda kapalı.' },
        { status: 403 }
      )
    }

    const user = await requireAuthUser()
    const body = (await request.json()) as {
      cariKod?: string
      messageBody?: string
      telefonlar?: string[]
    }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }

    const cari = await loadHatirlatmaCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }

    const kayitliNumaralar = cari.telefon_numaralari?.length
      ? cari.telefon_numaralari
      : cari.telefon
        ? [cari.telefon]
        : []
    if (!kayitliNumaralar.length) {
      return NextResponse.json(
        { success: false, error: 'Gönderim için kayıtlı cep telefonu gerekli.' },
        { status: 400 }
      )
    }

    // Alıcı listesi: istekte seçim varsa kayıtlı numaralarla kesiştir; yoksa tüm kayıtlılar.
    let alicilar = kayitliNumaralar
    if (Array.isArray(body.telefonlar)) {
      const istenen = [
        ...new Set(
          body.telefonlar
            .map((value) => normalizePhone(String(value || '')))
            .filter((value): value is string => Boolean(value))
        ),
      ]
      const taninmayan = istenen.filter((tel) => !kayitliNumaralar.includes(tel))
      if (taninmayan.length) {
        return NextResponse.json(
          {
            success: false,
            error: `Bu numaralar cari için kayıtlı değil: ${taninmayan
              .map((tel) => formatPhoneDisplay(tel))
              .join(', ')}. Önce telefonu kaydedin.`,
          },
          { status: 400 }
        )
      }
      alicilar = istenen
    }
    if (!alicilar.length) {
      return NextResponse.json(
        { success: false, error: 'En az bir alıcı numarası seçin.' },
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
    const gonderimler: GonderimSonuc[] = []
    let logSayisi = 0

    // Her alıcı için ayrı kuyruk satırı + ayrı gönderim geçmişi kaydı.
    for (const telefon of alicilar) {
      if (!isMobileTurkey(telefon)) {
        gonderimler.push({
          telefon,
          hata: `${formatPhoneDisplay(telefon)} sabit hat — WhatsApp mesajı alamaz.`,
        })
        continue
      }
      try {
        const result = await sendHatirlatmaWhatsApp({
          to: formatPhoneWhatsApp(telefon),
          cariKod: cari.cari_kod,
          body: messageBody,
          cari,
        })
        gonderimler.push({ telefon, kuyrukId: result.kuyrukId, jid: result.jid })

        const logResult = await insertMailGonderimLog({
          mail_to: telefon,
          subject: defaultMessage.ozet,
          body_preview: JSON.stringify({
            kuyruk_id: result.kuyrukId,
            mesaj: messageBody.slice(0, 200),
          }),
          kaynak: HATIRLATMA_LOG_KAYNAK,
          ilgili_id: cari.cari_kod,
          ilgili_tip: WHATSAPP_SEND_TIP,
          sent_at: sentAt,
          gonderen_user_id: user.id,
        })
        if (!logResult.ok) {
          console.error('[hatirlatma-whatsapp-log]', logResult.error)
        } else {
          logSayisi += 1
        }
      } catch (cause) {
        console.error('[hatirlatma-whatsapp-gonder]', telefon, cause)
        gonderimler.push({
          telefon,
          hata: toErrorMessage(cause, 'Kuyruğa eklenemedi.'),
        })
      }
    }

    const basarili = gonderimler.filter((item) => item.kuyrukId)
    const hatali = gonderimler.filter((item) => item.hata)
    const numaraListesi = (items: GonderimSonuc[]) =>
      items.map((item) => formatPhoneDisplay(item.telefon)).join(', ')

    if (!basarili.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Hiçbir numaraya gönderilemedi. ${hatali
            .map((item) => item.hata)
            .join(' ')}`,
          gonderimler,
        },
        { status: 502 }
      )
    }

    const logWarning =
      logSayisi < basarili.length ? ' (Bazı gönderim geçmişi kayıtları yazılamadı.)' : ''
    const hataNotu = hatali.length
      ? ` Gönderilemeyen: ${hatali.map((item) => item.hata).join(' ')}`
      : ''

    return NextResponse.json({
      success: true,
      message: `WhatsApp mesajı kuyruğa alındı → ${numaraListesi(basarili)}. Gönderen: ${WHATSAPP_SENDER_LABEL}.${logWarning}${hataNotu}`,
      sentAt,
      gonderimler,
      kuyrukId: basarili[0].kuyrukId,
      deliveryHint: hatirlatmaDeliveryHint(),
      gonderimSayisi: cari.whatsapp_gonderim_sayisi + logSayisi,
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
