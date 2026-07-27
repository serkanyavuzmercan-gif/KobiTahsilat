import { NextResponse } from 'next/server'
import { requireAuthUser } from '@/lib/auth'
import { toErrorMessage } from '@/lib/errors'
import { loadSnapshot } from '@/lib/data'
import { loadMutabakatCariler } from '@/lib/mutabakat-data'
import { loadHatirlatmaCariler } from '@/lib/hatirlatma-data'
import { buildMutabakatEmail } from '@/lib/mutabakat'
import { createMutabakatToken } from '@/lib/mutabakat-token'
import { buildHatirlatmaEmail } from '@/lib/automation/email-template'
import { buildHatirlatmaWhatsAppOnizleme } from '@/lib/hatirlatma-whatsapp'

export const dynamic = 'force-dynamic'

/**
 * Gönderim YAPMADAN, bir carinin gerçek mesaj içeriğini render eder (SON TEYİD önizlemesi).
 * ?cariKod=..&tur=mutabakat|odeme_talebi&kanal=email|whatsapp
 */
export async function GET(request: Request) {
  try {
    await requireAuthUser()
    const url = new URL(request.url)
    const cariKod = String(url.searchParams.get('cariKod') || '').trim()
    const tur = String(url.searchParams.get('tur') || 'mutabakat')
    const kanal = String(url.searchParams.get('kanal') || 'email')
    if (!cariKod) {
      return NextResponse.json({ success: false, error: 'cariKod gerekli.' }, { status: 400 })
    }

    const snapshot = await loadSnapshot()
    const tarih = snapshot.snapshot_tarihi

    if (tur === 'mutabakat') {
      const cariler = await loadMutabakatCariler()
      const cari = cariler.find((c) => c.cari_kod === cariKod)
      if (!cari) return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
      const token = createMutabakatToken(cari.cari_kod, tarih, cari.bakiye)
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://finans.hidroteknik.com.tr').replace(/\/$/, '')
      const email = buildMutabakatEmail(cari, tarih, {
        onayUrl: `${baseUrl}/mutabakat/onay/${encodeURIComponent(token)}`,
        itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
      })
      return NextResponse.json({
        success: true,
        kanal: 'email',
        firma: cari.firma_adi,
        alici: cari.email_adresleri[0] || null,
        subject: email.subject,
        html: email.html,
      })
    }

    // odeme_talebi
    if (kanal === 'whatsapp') {
      const cariler = await loadHatirlatmaCariler()
      const cari = cariler.find((c) => c.cari_kod === cariKod)
      if (!cari) return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
      const onizleme = await buildHatirlatmaWhatsAppOnizleme(cari, tarih)
      return NextResponse.json({
        success: true,
        kanal: 'whatsapp',
        firma: cari.firma_adi,
        alici: cari.telefon || null,
        text: onizleme.text,
      })
    }

    // odeme_talebi / email
    const cariler = await loadMutabakatCariler()
    const cari = cariler.find((c) => c.cari_kod === cariKod)
    if (!cari) return NextResponse.json({ success: false, error: 'Cari bulunamadı.' }, { status: 404 })
    const email = buildHatirlatmaEmail(cari, tarih)
    return NextResponse.json({
      success: true,
      kanal: 'email',
      firma: cari.firma_adi,
      alici: cari.email_adresleri[0] || null,
      subject: email.subject,
      html: email.html,
    })
  } catch (cause) {
    console.error('[otomasyon-onizle]', cause)
    const message = toErrorMessage(cause, 'Önizleme oluşturulamadı.')
    return NextResponse.json(
      { success: false, error: message },
      { status: message.includes('Oturum') ? 401 : 500 }
    )
  }
}
