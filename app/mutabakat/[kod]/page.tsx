import { notFound } from 'next/navigation'
import { AlertTriangle, CalendarClock, Mail } from 'lucide-react'
import { BackLink } from '@/components/ui/button'
import { CariEmailEditor } from '@/components/cari-email-editor'
import { MutabakatSendPanel } from '@/components/mutabakat-send-panel'
import { requireAuthUser } from '@/lib/auth'
import { loadIletisimEtiketleri } from '@/lib/cari-kisiler'
import { loadSnapshot } from '@/lib/data'
import { buildMutabakatEmail, formatDate } from '@/lib/mutabakat'
import { loadMutabakatCari } from '@/lib/mutabakat-data'
import { createMutabakatToken } from '@/lib/mutabakat-token'
import { formatTL } from '@/lib/types'

export const dynamic = 'force-dynamic'

function sendEnabled() {
  return process.env.MUTABAKAT_SEND_ENABLED !== 'false'
}

/** YYYY-MM-DD, gelecek olmayan (bugün veya geçmiş) geçerli tarih → aksi halde null. */
function normalizeMutabakatTarihi(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const bugun = new Date().toISOString().slice(0, 10)
  if (value > bugun) return null // gelecek tarihe izin yok
  if (Number(value.slice(0, 4)) < 2000) return null
  return value
}

export default async function MutabakatPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ kod: string }>
  searchParams: Promise<{ d?: string }>
}) {
  const { kod: encodedKod } = await params
  const cari = await loadMutabakatCari(decodeURIComponent(encodedKod))
  if (!cari) notFound()

  await requireAuthUser()
  const canSend = sendEnabled()

  const snapshot = await loadSnapshot()
  const { d } = await searchParams
  const secilenTarih = normalizeMutabakatTarihi(d) || snapshot.snapshot_tarihi

  const token = createMutabakatToken(cari.cari_kod, secilenTarih, cari.bakiye)
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobi-tahsilat.vercel.app').replace(/\/$/, '')
  const email = buildMutabakatEmail(cari, secilenTarih, {
    onayUrl: `${baseUrl}/mutabakat/onay/${encodeURIComponent(token)}`,
    itirazUrl: `${baseUrl}/mutabakat/itiraz/${encodeURIComponent(token)}`,
  })

  // Alıcı e-postaları yanına yazılacak açıklamalar (ad + rol; cari_kisiler'den).
  const etiketler = await loadIletisimEtiketleri([cari.cari_kod])
  const emailEtiket = etiketler[cari.cari_kod]?.email

  return (
    <div className="space-y-4">
      <BackLink href="/mutabakat">Mutabakat listesine dön</BackLink>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
        {/* Sol: firma başlığı + e-posta önizlemesi */}
        <div className="space-y-4">
          <section className="card p-5">
            <p className="font-mono text-xs text-slate-400">{cari.cari_kod}</p>
            <h2 className="mt-1 text-xl font-semibold">{cari.firma_adi}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                Bakiye: {formatTL(cari.bakiye)}
              </span>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                Gecikmiş: {formatTL(cari.gecikmis_bakiye)}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                Dönem: {formatDate(email.mutabakatTarihi)}
              </span>
            </div>

            {!cari.email && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p>Bu firmanın doğrulanmış e-posta adresi bulunmuyor.</p>
                  {cari.email_adaylari.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-medium">Gmail/yazışma geçmişinden bulunan adaylar:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {cari.email_adaylari.map((aday) => (
                          <li key={aday.email}>
                            {aday.email} <span className="text-amber-700">({aday.kaynak})</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs">Personel onayı olmadan gönderime açılmaz.</p>
                    </div>
                  ) : (
                    <p className="mt-1">Gönderimden önce adres eklenmelidir.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm">
            <div className="border-b border-slate-300 bg-white px-4 py-3">
              <p className="text-sm font-medium">Müşterinin göreceği e-posta</p>
              <p className="text-xs text-slate-500">
                Masaüstü ve mobil e-posta istemcileri için uyumlu HTML
              </p>
            </div>
            <iframe
              title={`${cari.firma_adi} mutabakat e-postası önizlemesi`}
              srcDoc={email.html}
              className="h-[820px] w-full bg-slate-100"
              sandbox="allow-top-navigation-by-user-activation"
            />
          </section>
        </div>

        {/* Sağ: yapışkan gönderim paneli */}
        <aside className="mt-4 lg:mt-0">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm lg:sticky lg:top-4">
            <div className="flex items-start gap-2">
              <Mail size={17} className="mt-0.5 text-brand-600" />
              <div className="w-full">
                <p className="text-xs text-slate-500">Alıcı</p>
                <div className="mt-2">
                  <CariEmailEditor
                    cariKod={cari.cari_kod}
                    initialEmails={cari.email_adresleri}
                    candidates={cari.email_adaylari}
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Konu: {email.subject}
            </p>
            <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3">
              <CalendarClock size={16} className="mt-0.5 shrink-0 text-brand-600" />
              <div>
                <p className="text-xs text-slate-500">Son mutabakat gönderimi</p>
                <p className="mt-0.5 font-medium">
                  {cari.mutabakat_son_gonderim
                    ? new Date(cari.mutabakat_son_gonderim).toLocaleString('tr-TR')
                    : 'Henüz gönderilmedi'}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Gönderim</p>
              <MutabakatSendPanel
                cariKod={cari.cari_kod}
                mutabakatTarihi={secilenTarih}
                bugun={snapshot.snapshot_tarihi}
                hasRecipient={Boolean(cari.email)}
                emailAdresleri={cari.email_adresleri}
                sendBlocked={cari.mutabakat_gonderim_engelli}
                blockedUntil={cari.mutabakat_tekrar_gonderilebilir_at}
                sendEnabled={canSend}
                emailEtiket={emailEtiket}
              />
            </div>
            {canSend ? (
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                Mutabakat <strong>{process.env.GMAIL_SENDER || 'Hidroteknik'}</strong> üzerinden
                gönderilir; yanıtlar da aynı kutuya döner.
              </p>
            ) : (
              <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-amber-700">
                Gönderim şu anda kapalı (`MUTABAKAT_SEND_ENABLED`).
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
