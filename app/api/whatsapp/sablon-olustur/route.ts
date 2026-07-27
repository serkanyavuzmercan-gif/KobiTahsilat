import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * TEK SEFERLİK: PayTR ödeme butonlu WhatsApp şablonunu Meta'ya onaya gönderir.
 * Token sunucuda (WHATSAPP_TOKEN) — dışarı sızmaz. WABA env yoksa bilinen id'ye düşer.
 * Onaylanınca gönderim kodu bu şablonu URL-buton token'ıyla kullanacak.
 */
const TEMPLATE_NAME = 'odeme_talebi_odeme_linkli'
const BASE = 'https://finans.hidroteknik.com.tr/o/'

export async function GET() {
  try {
    await requireAuthUser()
    const token = process.env.WHATSAPP_TOKEN
    const waba = process.env.WHATSAPP_WABA_ID || '1720920545614381'
    const graph = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`
    if (!token) {
      return NextResponse.json({ success: false, error: 'WHATSAPP_TOKEN tanımlı değil.' }, { status: 500 })
    }

    const body = {
      name: TEMPLATE_NAME,
      language: 'tr',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text:
            'Sayın {{1}} yetkilisi, cari hesabınızda vadesi geçen {{2}} tutarında bakiyeniz bulunmaktadır. ' +
            'Ödeme yapmak için aşağıdaki butonu kullanabilirsiniz.',
          example: { body_text: [['ABC Makina Ltd. Şti.', '12.500,00 TL']] },
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'URL',
              text: 'Ödeme Yap',
              url: `${BASE}{{1}}`,
              example: [`${BASE}ornek123abc`],
            },
          ],
        },
      ],
    }

    const res = await fetch(`${graph}/${waba}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ success: false, meta: json }, { status: res.status })
    }
    return NextResponse.json({
      success: true,
      mesaj: `Şablon '${TEMPLATE_NAME}' onaya gönderildi. Meta'da durum PENDING → APPROVED olunca bana haber ver.`,
      meta: json,
    })
  } catch (cause) {
    console.error('[wa-sablon-olustur]', cause)
    const message = toErrorMessage(cause, 'Şablon oluşturulamadı.')
    return NextResponse.json({ success: false, error: message }, { status: message.includes('Oturum') ? 401 : 500 })
  }
}
