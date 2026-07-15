import { notFound } from 'next/navigation'
import { AlertTriangle, CalendarClock, MessageCircle } from 'lucide-react'
import { BackLink } from '@/components/ui/button'
import { CariTelefonEditor } from '@/components/cari-telefon-editor'
import { HatirlatmaMessageEditor } from '@/components/hatirlatma-message-editor'
import { HatirlatmaMessageProvider } from '@/components/hatirlatma-message-context'
import { HatirlatmaSendPanel } from '@/components/hatirlatma-send-panel'
import { loadSnapshot } from '@/lib/data'
import { buildHatirlatmaMessage } from '@/lib/hatirlatma'
import { loadHatirlatmaCari } from '@/lib/hatirlatma-data'
import { formatPhoneDisplay, isMobileTurkey } from '@/lib/phone'
import { formatTL } from '@/lib/types'
import { whatsAppSendEnabled } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function HatirlatmaPreviewPage({
  params,
}: {
  params: Promise<{ kod: string }>
}) {
  const { kod: encodedKod } = await params
  const cari = await loadHatirlatmaCari(decodeURIComponent(encodedKod))
  if (!cari) notFound()

  const snapshot = loadSnapshot()
  const message = buildHatirlatmaMessage(cari, snapshot.snapshot_tarihi)
  const sendEnabled = whatsAppSendEnabled()

  return (
    <HatirlatmaMessageProvider defaultBody={message.body}>
      <div className="space-y-5">
        <BackLink href="/hatirlatma">Hatırlatma listesine dön</BackLink>

        <section className="card p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="font-mono text-xs text-slate-400">{cari.cari_kod}</p>
              <h2 className="mt-1 text-xl font-semibold">{cari.firma_adi}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  Bakiye: {formatTL(cari.bakiye)}
                </span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                  Gecikmiş: {formatTL(cari.gecikmis_bakiye)}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  WhatsApp gönderim: {cari.whatsapp_gonderim_sayisi}
                </span>
              </div>
            </div>

            <div className="min-w-72 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-start gap-2">
                <MessageCircle size={17} className="mt-0.5 text-emerald-600" />
                <div className="w-full">
                  <p className="text-xs text-slate-500">Alıcı (WhatsApp)</p>
                  <div className="mt-2">
                    <CariTelefonEditor
                      cariKod={cari.cari_kod}
                      initialPhones={cari.telefon_numaralari}
                      candidates={cari.telefon_adaylari}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3">
                <CalendarClock size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-slate-500">Son WhatsApp gönderimi</p>
                  <p className="mt-0.5 font-medium">
                    {cari.whatsapp_son_gonderim
                      ? new Date(cari.whatsapp_son_gonderim).toLocaleString('tr-TR')
                      : 'Henüz gönderilmedi'}
                  </p>
                  {cari.whatsapp_gonderim_sayisi > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Toplam {cari.whatsapp_gonderim_sayisi} gönderim
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3">
                <HatirlatmaSendPanel
                  cariKod={cari.cari_kod}
                  hasPhone={Boolean(cari.telefon)}
                  isMobile={isMobileTurkey(cari.telefon)}
                  sendEnabled={sendEnabled}
                  gonderimSayisi={cari.whatsapp_gonderim_sayisi}
                />
              </div>
            </div>
          </div>

          {!cari.telefon && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p>Bu firmanın doğrulanmış cep telefonu bulunmuyor.</p>
                {cari.telefon_adaylari.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5">
                    {cari.telefon_adaylari.map((aday) => (
                      <li key={aday.telefon}>
                        {formatPhoneDisplay(aday.telefon)}{' '}
                        <span className="text-amber-700">({aday.kaynak})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1">Gönderimden önce cep telefonu eklenmelidir.</p>
                )}
              </div>
            </div>
          )}
        </section>

        <HatirlatmaMessageEditor />
      </div>
    </HatirlatmaMessageProvider>
  )
}
