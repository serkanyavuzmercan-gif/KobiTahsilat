import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { MAIL_LOG_KAYNAK } from '@/lib/mutabakat-log'
import { insertMailGonderimLog } from '@/lib/mail-gonderim-log'
import { loadSnapshot } from '@/lib/data'
import { normalizeEmail } from '@/lib/email'
import { sendMail } from '@/lib/mail'
import { buildMutabakatEmail } from '@/lib/mutabakat'
import { loadMutabakatCari } from '@/lib/mutabakat-data'
import { createMutabakatToken } from '@/lib/mutabakat-token'

export const dynamic = 'force-dynamic'

function sendEnabled() {
  return process.env.MUTABAKAT_SEND_ENABLED !== 'false'
}

/** YYYY-MM-DD, gelecek olmayan (bugün veya geçmiş) geçerli tarih → aksi halde null. */
function normalizeMutabakatTarihi(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const bugun = new Date().toISOString().slice(0, 10)
  if (value > bugun) return null
  if (Number(value.slice(0, 4)) < 2000) return null
  return value
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
    const body = (await request.json()) as {
      cariKod?: string
      senderId?: string
      mutabakatTarihi?: string
      recipients?: string[]
    }
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
    // ASLA tüm adreslere birden gönderme. Kullanıcının seçtiği adreslere gider; seçim yoksa
    // yalnız VARSAYILAN (ilk) adres. Kayıtlı adresler VEYA elle girilen geçerli e-postalar kabul
    // edilir (garbage elenir); böylece listede olmayan özel bir alıcıya da gönderilebilir.
    const istenenAlicilar = Array.isArray(body.recipients) ? body.recipients.map(String) : []
    const secilenAlicilar = istenenAlicilar
      .map((e) => (cari.email_adresleri.includes(e) ? e : normalizeEmail(e)))
      .filter((e): e is string => Boolean(e))
    const alicilar = secilenAlicilar.length
      ? [...new Set(secilenAlicilar)]
      : [cari.email_adresleri[0]]
    if (cari.mutabakat_gonderim_engelli) {
      return NextResponse.json(
        {
          success: false,
          error: 'Son gönderimden sonra 8 iş günü dolmadan tekrar gönderilemez.',
        },
        { status: 409 }
      )
    }

    const snapshot = await loadSnapshot()
    // Önizlemede seçilen tarih (geçmiş tarihli mutabakat) → token + e-posta aynı tarihi kullanır.
    const secilenTarih = normalizeMutabakatTarihi(body.mutabakatTarihi) || snapshot.snapshot_tarihi
    const token = createMutabakatToken(cari.cari_kod, secilenTarih, cari.bakiye)
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobi-tahsilat.vercel.app').replace(
      /\/$/,
      ''
    )
    const email = buildMutabakatEmail(cari, secilenTarih, {
      onayUrl: `${baseUrl}/mutabakat/onay/${encodeURIComponent(token)}`,
      itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
    })
    // Gönderen sabit: Gmail (GMAIL_SENDER = serkan.mercan@). Yanıtlar da aynı kutuya döner.
    const from = process.env.GMAIL_SENDER || process.env.MAIL_FROM || 'Hidroteknik A.Ş.'
    const sentAt = new Date().toISOString()

    const result = await sendMail({
      to: alicilar,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })

    const logResult = await insertMailGonderimLog({
      mail_to: alicilar.join('; '),
      mail_from: from,
      subject: email.subject,
      body_preview: `${cari.firma_adi} mutabakatı gönderildi`,
      kaynak: MAIL_LOG_KAYNAK,
      ilgili_id: cari.cari_kod,
      ilgili_tip: 'mutabakat',
      sent_at: sentAt,
      gonderen_user_id: user.id,
    })
    if (!logResult.ok) {
      console.error('[mutabakat-gonder-log]', logResult.error)
    }

    return NextResponse.json({
      success: true,
      message: `Mutabakat e-postası ${alicilar.join(', ')} adresine gönderildi.`,
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
