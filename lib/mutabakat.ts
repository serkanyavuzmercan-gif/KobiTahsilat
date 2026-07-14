import type { CariBakiye } from './types'
import { formatTL } from './types'

export type MutabakatEmail = {
  to: string[]
  subject: string
  html: string
  text: string
  mutabakatTarihi: string
  sonYanitTarihi: string
}

export function buildMutabakatEmail(
  cari: CariBakiye,
  snapshotTarihi: string,
  options?: { onayUrl?: string; itirazUrl?: string }
): MutabakatEmail {
  const mutabakatTarihi = snapshotTarihi
  const sonYanitTarihi = addBusinessDays(snapshotTarihi, 8)
  const firma = escapeHtml(cari.firma_adi)
  const cariKod = escapeHtml(cari.cari_kod)
  const bakiye = escapeHtml(formatTL(cari.bakiye))
  const gecikmis = escapeHtml(formatTL(cari.gecikmis_bakiye))
  const onayUrl = escapeAttribute(options?.onayUrl || '#onay')
  const itirazUrl = escapeAttribute(options?.itirazUrl || '#itiraz')
  const subject = `${formatDate(mutabakatTarihi)} tarihli cari hesap bakiye mutabakatı`

  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,'Helvetica Neue',sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.10)">
        <tr>
          <td style="background:#0f3d64;padding:26px 30px;color:#ffffff">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#bfdbfe">Hidroteknik A.Ş.</div>
                  <div style="font-size:25px;font-weight:700;margin-top:7px">Cari Hesap Mutabakatı</div>
                </td>
                <td align="right">
                  <div style="display:inline-block;padding:7px 9px;border-radius:12px;background:#ffffff">
                    <img src="https://files.cdn-files-a.com/uploads/5644137/400_6865986816fbc.png" width="74" alt="Hidroteknik A.Ş." style="display:block;width:74px;max-height:42px;object-fit:contain;border:0">
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:30px">
            <p style="margin:0 0 8px;font-size:16px">Sayın Yetkili,</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.7">
              Kayıtlarımızın karşılıklı doğrulanması amacıyla, aşağıdaki cari hesap bakiyesini
              kontrol ederek <strong>${escapeHtml(formatDate(sonYanitTarihi))}</strong> tarihine kadar
              yanıtlamanızı rica ederiz.
            </p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <tr>
                <td style="padding:16px;background:#f8fafc;border-bottom:1px solid #e2e8f0">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#64748b">Muhatap</div>
                  <div style="margin-top:5px;font-size:16px;font-weight:700">${firma}</div>
                  <div style="margin-top:4px;font-size:12px;color:#64748b">Cari kod: ${cariKod}</div>
                </td>
                <td style="padding:16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-align:right">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#64748b">Mutabakat tarihi</div>
                  <div style="margin-top:5px;font-size:16px;font-weight:700">${escapeHtml(formatDate(mutabakatTarihi))}</div>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:24px;text-align:center">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b">Kayıtlarımıza göre borç bakiyeniz</div>
                  <div style="margin-top:8px;font-size:34px;font-weight:800;color:#0f3d64">${bakiye}</div>
                  <div style="margin:18px auto 0;max-width:310px;padding:13px 16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#991b1b;font-weight:700">Vadesi geçmiş bakiye</div>
                    <div style="margin-top:5px;font-size:22px;color:#b91c1c;font-weight:800">${gecikmis}</div>
                  </div>
                </td>
              </tr>
            </table>

            <div style="margin-top:22px;padding:14px 16px;border-left:4px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#92400e;font-size:13px;line-height:1.6">
              Bu çalışma yalnızca bakiye mutabakatı içindir. Ödeme talimatı veya banka hesap
              değişikliği içermez. Farklılık varsa itiraz seçeneğinden açıklamanızı iletebilirsiniz.
            </div>

            <div style="margin-top:14px;padding:16px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:10px;color:#334155;font-size:12px;line-height:1.7">
              <div style="margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#0f3d64;font-weight:700">Yasal bilgilendirme</div>
              Türk Ticaret Kanunu’nun ilgili maddeleri gereğince, işbu mutabakat mektubunun
              tarafınıza ulaştığı tarihten itibaren 8 (sekiz) iş günü içinde yazılı bir itirazda
              bulunulmaması halinde, yukarıda belirtilen bakiye taraflarca mutabık (kabul edilmiş)
              sayılacaktır. Cari hesaplarımızın güncel kalması ve ticari süreçlerimizin aksamaması
              adına göstereceğiniz hassasiyet için teşekkür ederiz.
            </div>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px">
              <tr>
                <td width="49%" align="center">
                  <a href="${onayUrl}" target="_top" style="display:block;padding:14px 10px;border-radius:10px;background:#16865a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">
                    Evet, mutabıkız
                  </a>
                </td>
                <td width="2%"></td>
                <td width="49%" align="center">
                  <a href="${itirazUrl}" target="_top" style="display:block;padding:14px 10px;border-radius:10px;background:#ffffff;color:#b42318;text-decoration:none;font-size:14px;font-weight:700;border:1px solid #f1a6a0">
                    Fark var / itiraz et
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center">
              Sorularınız için <a href="mailto:info@hidroteknik.com.tr" style="color:#0f3d64">info@hidroteknik.com.tr</a>
              veya +90 258 251 40 60 üzerinden bize ulaşabilirsiniz.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 30px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.6;text-align:center">
            Hidroteknik A.Ş. · Denizli, Türkiye<br>
            Bu e-posta cari hesap mutabakatı amacıyla hazırlanmıştır.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = `HİDROTEKNİK A.Ş. — CARİ HESAP MUTABAKATI

Sayın Yetkili,

${formatDate(mutabakatTarihi)} tarihi itibarıyla kayıtlarımıza göre:
Firma: ${cari.firma_adi}
Cari kod: ${cari.cari_kod}
Borç bakiyesi: ${formatTL(cari.bakiye)}
Vadesi geçmiş: ${formatTL(cari.gecikmis_bakiye)}

Lütfen ${formatDate(sonYanitTarihi)} tarihine kadar mutabık olup olmadığınızı bildiriniz.

Türk Ticaret Kanunu’nun ilgili maddeleri gereğince, işbu mutabakat mektubunun tarafınıza
ulaştığı tarihten itibaren 8 (sekiz) iş günü içinde yazılı bir itirazda bulunulmaması halinde,
yukarıda belirtilen bakiye taraflarca mutabık (kabul edilmiş) sayılacaktır. Cari hesaplarımızın
güncel kalması ve ticari süreçlerimizin aksamaması adına göstereceğiniz hassasiyet için teşekkür ederiz.

Hidroteknik A.Ş.
info@hidroteknik.com.tr · +90 258 251 40 60`

  return {
    to: cari.email_adresleri,
    subject,
    html,
    text,
    mutabakatTarihi,
    sonYanitTarihi,
  }
}

function addBusinessDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`)
  let added = 0
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1)
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) added++
  }
  return date.toISOString().slice(0, 10)
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR').format(new Date(`${iso}T00:00:00Z`))
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;')
}
