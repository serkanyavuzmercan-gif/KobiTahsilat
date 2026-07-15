import { NextResponse } from 'next/server'
import { getCari } from '@/lib/data'
import { renderOdemeTalepPdf } from '@/lib/odeme-talep-pdf'
import { verifyOdemeTalepToken } from '@/lib/odeme-talep-token'

export const dynamic = 'force-dynamic'

/** Müşteriye açık PDF: WhatsApp linki / e-posta eki bu route'tan üretilir (token imzalı). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') || ''
  const payload = verifyOdemeTalepToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: 'Geçersiz veya süresi dolmuş bağlantı.' },
      { status: 403 }
    )
  }

  const cari = await getCari(payload.cariKod)
  if (!cari) {
    return NextResponse.json({ error: 'Cari bulunamadı.' }, { status: 404 })
  }

  const pdfBytes = await renderOdemeTalepPdf(cari, payload.snapshotTarihi)
  const fileName = `odeme-talebi-${cari.cari_kod}.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
