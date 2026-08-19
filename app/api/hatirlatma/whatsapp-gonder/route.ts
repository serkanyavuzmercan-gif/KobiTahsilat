import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { loadSnapshot } from '@/lib/data'
import { toErrorMessage } from '@/lib/errors'
import { buildHatirlatmaMessage } from '@/lib/hatirlatma'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { HATIRLATMA_LOG_KAYNAK, WHATSAPP_SEND_TIP } from '@/lib/hatirlatma-log'
import { formatPhoneDisplay, formatPhoneWhatsApp, isMobileTurkey, normalizePhone } from '@/lib/phone'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { hatirlatmaDeliveryHint, ODEME_TALEP_TEMPLATE, sendHatirlatmaWhatsApp } from '@/lib/hatirlatma-whatsapp'
import { whatsAppBotEnabled } from '@/lib/whatsapp-kuyruk'
import { cariSonOdeme } from '@/lib/odeme-tespit'
import { yukseltmeKapisi } from '@/lib/tahsilat-baski'
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
    const body = (await request.json()) as {
      cariKod?: string
      messageBody?: string
      phones?: string[]
      /** Yükseltme onayı — son 7 günde zaten evrak gittiyse gönderim bu bayrak olmadan reddedilir. */
      yukseltmeOnay?: boolean
    }
    const cariKod = String(body.cariKod || '').trim()
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'Cari kodu gerekli.' }, { status: 400 })
    }

    // YÜKSELTMEYE İNSAN ONAYI: kısa sürede ikinci evrak sessizce gitmez (bkz. lib/tahsilat-baski.ts).
    const kapi = await yukseltmeKapisi(cariKod, Boolean(body.yukseltmeOnay))
    if (kapi.engel) {
      return NextResponse.json(
        { success: false, error: kapi.engel, yukseltme: true, baski: kapi.durum },
        { status: 409 }
      )
    }

    const cari = await loadHatirlatmaCari(cariKod)
    if (!cari) {
      return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    }
    // NOT: Carinin KAYITLI telefonu olmasa da gönderilebilir — kullanıcı modalda ELLE numara
    // girebiliyor (girilen numara aynı zamanda carie kalıcı kaydediliyor). Bu yüzden burada
    // "kayıtlı telefon yoksa reddet" kontrolü YOKTUR; geçerlilik aşağıda elle girilen numaralar
    // dahil edilerek yapılır.
    // ASLA tüm numaralara birden gönderme. Seçilenler; seçim yoksa yalnız VARSAYILAN (ilk).
    // Kayıtlı numaralar VEYA elle girilen geçerli cep numaraları kabul edilir (garbage elenir).
    // Yalnız cep (mobil) numaralara WhatsApp gider.
    const istenenNumaralar = Array.isArray(body.phones) ? body.phones.map(String) : []
    const secilenNumaralar = istenenNumaralar
      .map((p) => (cari.telefon_numaralari.includes(p) ? p : normalizePhone(p)))
      .filter((p): p is string => Boolean(p))
    const hedefNumaralar = [
      ...new Set(
        (secilenNumaralar.length ? secilenNumaralar : [cari.telefon]).filter(
          (p): p is string => Boolean(p) && isMobileTurkey(p)
        )
      ),
    ]
    if (!hedefNumaralar.length) {
      return NextResponse.json(
        {
          success: false,
          error: cari.telefon
            ? `WhatsApp için geçerli bir cep numarası seçin. Kayıtlı: ${formatPhoneDisplay(cari.telefon)}`
            : 'WhatsApp için geçerli bir cep numarası girin (05xx ile başlayan mobil numara).',
        },
        { status: 400 }
      )
    }

    const snapshot = await loadSnapshot()
    // Not: teşekkür satırı WhatsApp'ta GÖRÜNMEZ (Meta şablonu sabit); yalnız özet/loga yansır.
    const sonOdeme = (await cariSonOdeme(cari.cari_kod))?.odenen || 0
    const defaultMessage = buildHatirlatmaMessage(cari, snapshot.snapshot_tarihi, sonOdeme)
    const sentAt = new Date().toISOString()

    // Resmi WhatsApp Cloud API — proaktif ödeme talebi onaylı şablonla gider (serbest metin
    // 24 saat penceresi dışında Meta tarafından reddedilir). Şablon değişkenleri firma / vadesi
    // geçen tutar / PDF döküm linki cari'den otomatik doldurulur. Seçilen her numaraya ayrı gider.
    const wamids: string[] = []
    for (const numara of hedefNumaralar) {
      const result = await sendHatirlatmaWhatsApp({
        to: formatPhoneWhatsApp(numara),
        cari,
        snapshotTarihi: snapshot.snapshot_tarihi,
      })
      wamids.push(result.wamid)
    }

    const logResult = await insertMailGonderimLog({
      mail_to: hedefNumaralar.join(';'),
      subject: defaultMessage.ozet,
      body_preview: JSON.stringify({ wamids, sablon: ODEME_TALEP_TEMPLATE }),
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
      : ' (Gönderildi; ancak gönderim geçmişi kaydı yazılamadı.)'

    return NextResponse.json({
      success: true,
      message: `WhatsApp ödeme talebi gönderildi → ${hedefNumaralar
        .map((p) => formatPhoneDisplay(p))
        .join(', ')}. Gönderen: ${WHATSAPP_SENDER_LABEL}.${logWarning}`,
      sentAt,
      wamids,
      kuyrukId: wamids[0], // geriye uyum: tek-numara panelinin durum sorgusu için
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
