'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, LoaderCircle, Mail, MessageCircle, Send, X } from 'lucide-react'
import { buildOdemeTalepMesaj } from '@/lib/odeme-talep-mesaj'
import { formatPhoneDisplay, isMobileTurkey } from '@/lib/phone'
import { RecipientPicker } from '@/components/recipient-picker'
import type { HatirlatmaCari } from '@/lib/hatirlatma-data'

type Kanal = 'whatsapp' | 'email' | 'her-ikisi'

const KANAL_ETIKET: Record<Kanal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-posta',
  'her-ikisi': 'WhatsApp + E-posta',
}

async function postGonder(
  url: string,
  cariKod: string,
  messageBody: string,
  extra?: Record<string, unknown>
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cariKod, messageBody, ...extra }),
  })
  const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
  return result.message || 'Gönderildi.'
}

export function OdemeTalepActions({
  cari,
  snapshotTarihi,
  pdfUrl,
  sendEnabled,
  telefonEtiket,
  emailEtiket,
}: {
  cari: HatirlatmaCari
  snapshotTarihi: string
  pdfUrl: string
  sendEnabled: boolean
  telefonEtiket?: Record<string, string>
  emailEtiket?: Record<string, string>
}) {
  const telFormat = (p: string) => {
    const l = telefonEtiket?.[p]
    return formatPhoneDisplay(p) + (l ? `  —  ${l}` : '')
  }
  const mailFormat = (e: string) => {
    const l = emailEtiket?.[e]
    return e + (l ? `  —  ${l}` : '')
  }
  const router = useRouter()
  const [kanal, setKanal] = useState<Kanal | null>(null)
  // WhatsApp ve e-posta metinleri ayrı: "her ikisi"nde her kanal bağımsız düzenlenip önizlenir.
  const [waBody, setWaBody] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  // WhatsApp yalnız cep (mobil) numaralara gider.
  // Varsayılan: yalnız ilk (birincil) e-posta / numara seçili. Hepsine birden ASLA gitmez.
  const [mobilNumaralar, setMobilNumaralar] = useState<string[]>(
    cari.telefon_numaralari.filter(isMobileTurkey)
  )
  const [emailAdresleri, setEmailAdresleri] = useState<string[]>(cari.email_adresleri)
  const [alicilar, setAlicilar] = useState<string[]>(cari.email_adresleri.slice(0, 1))
  const [numaralar, setNumaralar] = useState<string[]>(mobilNumaralar.slice(0, 1))

  async function numaraSil(telefon: string) {
    setMobilNumaralar((list) => list.filter((p) => p !== telefon))
    setNumaralar((list) => list.filter((p) => p !== telefon))
    try {
      await fetch('/api/cari-telefon/gizle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod: cari.cari_kod, telefon }),
      })
    } catch {
      /* optimistik */
    }
  }

  // Listede olmayan özel numara/e-posta ekle (yalnız bu gönderim için; seçili gelir).
  function numaraEkle(telefon: string) {
    setMobilNumaralar((list) => (list.includes(telefon) ? list : [...list, telefon]))
    setNumaralar((list) => (list.includes(telefon) ? list : [...list, telefon]))
  }

  function adresEkle(email: string) {
    setEmailAdresleri((list) => (list.includes(email) ? list : [...list, email]))
    setAlicilar((list) => (list.includes(email) ? list : [...list, email]))
  }

  async function adresSil(email: string) {
    setEmailAdresleri((list) => list.filter((e) => e !== email))
    setAlicilar((list) => list.filter((e) => e !== email))
    try {
      await fetch('/api/cari-email/gizle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod: cari.cari_kod, email }),
      })
    } catch {
      /* optimistik */
    }
  }

  const hasPhone = mobilNumaralar.length > 0
  const hasEmail = cari.email_adresleri.length > 0

  /** Butona basınca hemen göndermez; önizleme penceresini açar. */
  function acPencere(secilenKanal: Kanal) {
    setError('')
    setDone('')
    setAlicilar(emailAdresleri.slice(0, 1))
    setNumaralar(mobilNumaralar.slice(0, 1))
    const varsayilan = buildOdemeTalepMesaj(cari, snapshotTarihi, pdfUrl).body
    setWaBody(varsayilan)
    setMailBody(varsayilan)
    setKanal(secilenKanal)
  }

  function kapat() {
    if (loading) return
    setKanal(null)
    setError('')
  }

  async function gonder() {
    if (!kanal) return
    const waMetin = waBody.trim()
    const mailMetin = mailBody.trim()
    if ((kanal === 'whatsapp' || kanal === 'her-ikisi') && !waMetin) {
      setError('WhatsApp mesajı boş olamaz.')
      return
    }
    if ((kanal === 'email' || kanal === 'her-ikisi') && !mailMetin) {
      setError('E-posta mesajı boş olamaz.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const mesajlar: string[] = []
      if (kanal === 'whatsapp' || kanal === 'her-ikisi') {
        if (!numaralar.length) throw new Error('En az bir cep numarası seçin.')
        mesajlar.push(
          await postGonder('/api/hatirlatma/whatsapp-gonder', cari.cari_kod, waMetin, {
            phones: numaralar,
          })
        )
      }
      if (kanal === 'email' || kanal === 'her-ikisi') {
        if (!alicilar.length) throw new Error('En az bir e-posta alıcısı seçin.')
        mesajlar.push(
          await postGonder('/api/hatirlatma/email-gonder', cari.cari_kod, mailMetin, {
            recipients: alicilar,
          })
        )
      }
      setDone(mesajlar.join(' '))
      setKanal(null)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  // Gönder butonu: ilgili kanal(lar)ın metni dolu olmalı.
  const metinHazir =
    kanal === 'whatsapp'
      ? waBody.trim().length > 0
      : kanal === 'email'
        ? mailBody.trim().length > 0
        : waBody.trim().length > 0 && mailBody.trim().length > 0

  if (!sendEnabled) {
    return <span className="text-xs text-amber-700">Gönderim kapalı</span>
  }

  const btnBase =
    'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'

  const showWhatsApp = kanal === 'whatsapp' || kanal === 'her-ikisi'
  const showEmail = kanal === 'email' || kanal === 'her-ikisi'

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-nowrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => acPencere('whatsapp')}
          disabled={!hasPhone}
          title={hasPhone ? 'WhatsApp ile ödeme talebi' : 'Kayıtlı cep telefonu yok'}
          className={`${btnBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          <MessageCircle size={13} />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => acPencere('email')}
          disabled={!hasEmail}
          title={hasEmail ? 'E-posta ile ödeme talebi' : 'Doğrulanmış e-posta yok'}
          className={`${btnBase} bg-brand-50 text-brand-700 hover:bg-brand-100`}
        >
          <Mail size={13} />
          E-posta
        </button>
        <button
          type="button"
          onClick={() => acPencere('her-ikisi')}
          disabled={!hasPhone || !hasEmail}
          title={
            hasPhone && hasEmail
              ? 'Hem WhatsApp hem e-posta'
              : 'Her ikisi için telefon ve e-posta gerekli'
          }
          className={`${btnBase} bg-slate-800 text-white hover:bg-slate-900`}
        >
          <CheckCircle2 size={13} />
          Her ikisi
        </button>
      </div>
      {done && (
        <p className="max-w-[280px] text-right text-[11px] leading-tight text-emerald-700">{done}</p>
      )}

      {kanal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={kapat}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div className="text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                  Ödeme talebi · {KANAL_ETIKET[kanal]}
                </p>
                <h3 className="mt-0.5 text-base font-semibold text-slate-900">{cari.firma_adi}</h3>
              </div>
              <button
                type="button"
                onClick={kapat}
                disabled={loading}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4 text-left">
              {pdfUrl && (
                <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-brand-700">
                    <FileText size={14} />
                    Fatura dökümü PDF{showEmail && ' — e-postaya ek olarak gider'}
                    {showEmail && showWhatsApp && ', '}
                    {showWhatsApp && (showEmail ? 'WhatsApp mesajında link olarak' : ' — WhatsApp mesajında link olarak')}
                  </span>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-medium text-brand-700 underline hover:text-brand-800"
                  >
                    PDF&apos;i önizle
                  </a>
                </div>
              )}

              {showWhatsApp && (
                <div className="space-y-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <MessageCircle size={14} />
                    WhatsApp{kanal === 'her-ikisi' ? ' mesajı' : ''}
                  </p>
                  <RecipientPicker
                    kind="phone"
                    addresses={mobilNumaralar}
                    selected={numaralar}
                    onChange={setNumaralar}
                    format={telFormat}
                    onRemove={numaraSil}
                    onAdd={numaraEkle}
                  />
                  <textarea
                    value={waBody}
                    onChange={(event) => setWaBody(event.target.value)}
                    rows={kanal === 'her-ikisi' ? 8 : 12}
                    disabled={loading}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-400">
                    {waBody.length} karakter · *yıldız* arasındaki metin WhatsApp&apos;ta kalın görünür.
                  </p>
                </div>
              )}

              {showEmail && (
                <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                    <Mail size={14} />
                    E-posta{kanal === 'her-ikisi' ? ' mesajı' : ''}
                  </p>
                  <RecipientPicker
                    addresses={emailAdresleri}
                    selected={alicilar}
                    onChange={setAlicilar}
                    format={mailFormat}
                    onRemove={adresSil}
                    onAdd={adresEkle}
                  />
                  <textarea
                    value={mailBody}
                    onChange={(event) => setMailBody(event.target.value)}
                    rows={kanal === 'her-ikisi' ? 8 : 12}
                    disabled={loading}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50"
                  />
                  <p className="text-[11px] text-slate-400">
                    {mailBody.length} karakter · fatura dökümü PDF olarak eklenir.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={kapat}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={gonder}
                disabled={loading || !metinHazir}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                {KANAL_ETIKET[kanal]} gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
