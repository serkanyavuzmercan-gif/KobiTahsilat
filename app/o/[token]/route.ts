import { NextResponse } from 'next/server'
import { findLinkByToken } from '@/lib/odeme-link'

export const dynamic = 'force-dynamic'

/**
 * Müşteriye giden kısa ödeme linki: /o/<token> → PayTR ödeme sayfasına 302.
 * Kendi domainimizde olması: Meta şablon kuralına uyum (sabit taban + dinamik ek), iptal/expiry
 * kontrolü bizde, tık logu. Ödenen/iptal linkler PayTR'ye yönlendirilmez.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const link = await findLinkByToken(decodeURIComponent(token))

  if (!link || !link.paytr_url) {
    return new NextResponse(sayfa('Ödeme bağlantısı bulunamadı', 'Bu ödeme bağlantısı geçersiz veya kaldırılmış.'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  if (link.durum === 'odendi') {
    return new NextResponse(sayfa('Ödeme alınmış', 'Bu bağlantı için ödemeniz zaten alınmıştır. Teşekkür ederiz.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  if (link.durum === 'iptal') {
    return new NextResponse(sayfa('Bağlantı iptal edildi', 'Bu ödeme bağlantısı iptal edilmiştir. Lütfen bizimle iletişime geçin.'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  return NextResponse.redirect(link.paytr_url, 302)
}

function sayfa(baslik: string, mesaj: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${baslik}</title></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:40px;color:#1e293b">
<div style="max-width:440px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center">
<h1 style="font-size:20px;margin:0 0 8px">${baslik}</h1>
<p style="color:#475569;font-size:14px;line-height:1.6;margin:0">${mesaj}</p>
<p style="color:#94a3b8;font-size:12px;margin-top:24px">Hidroteknik A.Ş.</p>
</div></body></html>`
}
