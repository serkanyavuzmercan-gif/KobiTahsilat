import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { renderOdemeTalepPdf } from '@/lib/odeme-talep-pdf'
import { resolveDokumCode } from '@/lib/dokum-link'
import { getOrCreateOdemeLinkForCari } from '@/lib/odeme-link'

export const dynamic = 'force-dynamic'

/** Kısa döküm linki: /d/<code> → ödeme talebi PDF (WhatsApp'taki uzun URL'nin kısası). */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ref = await resolveDokumCode(decodeURIComponent(code))
  if (!ref) {
    return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' }, { status: 404 })
  }

  const cari = await getCari(ref.cariKod)
  if (!cari) {
    return NextResponse.json({ error: 'Cari bulunamadı.' }, { status: 404 })
  }

  const odeme = await getOrCreateOdemeLinkForCari({
    cariKod: cari.cari_kod,
    firmaAdi: cari.firma_adi,
    cariEmail: cari.email_adresleri[0] || null,
    amountKurus: Math.round(cari.gecikmis_bakiye * 100),
  })
  const pdfBytes = await renderOdemeTalepPdf(cari, ref.snapshotTarihi, odeme?.kisaLink)

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="odeme-talebi-${cari.cari_kod}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
