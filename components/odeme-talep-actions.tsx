'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, Mail, MessageCircle, Send, X } from 'lucide-react'
import { buildHatirlatmaMessage } from '@/lib/hatirlatma'
import { formatPhoneDisplay } from '@/lib/phone'
import type { HatirlatmaCari } from '@/lib/hatirlatma-data'

type Kanal = 'whatsapp' | 'email' | 'her-ikisi'

const KANAL_ETIKET: Record<Kanal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-posta',
  'her-ikisi': 'WhatsApp + E-posta',
}

async function postGonder(url: string, cariKod: string, messageBody: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cariKod, messageBody }),
  })
  const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
  return result.message || 'Gönderildi.'
}

export function OdemeTalepActions({
  cari,
  snapshotTarihi,
  sendEnabled,
}: {
  cari: HatirlatmaCari
  snapshotTarihi: string
  sendEnabled: boolean
}) {
  const router = useRouter()
  const [kanal, setKanal] = useState<Kanal | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const hasPhone = Boolean(cari.telefon)
  const hasEmail = cari.email_adresleri.length > 0

  /** Butona basınca hemen göndermez; önizleme penceresini açar. */
  function acPencere(secilenKanal: Kanal) {
    setError('')
    setDone('')
    setBody(buildHatirlatmaMessage(cari, snapshotTarihi).body)
    setKanal(secilenKanal)
  }

  function kapat() {
    if (loading) return
    setKanal(null)
    setError('')
  }

  async function gonder() {
    if (!kanal) return
    const metin = body.trim()
    if (!metin) {
      setError('Mesaj metni boş olamaz.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const mesajlar: string[] = []
      if (kanal === 'whatsapp' || kanal === 'her-ikisi') {
        mesajlar.push(await postGonder('/api/hatirlatma/whatsapp-gonder', cari.cari_kod, metin))
      }
      if (kanal === 'email' || kanal === 'her-ikisi') {
        mesajlar.push(await postGonder('/api/hatirlatma/email-gonder', cari.cari_kod, metin))
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

            <div className="space-y-3 px-5 py-4 text-left">
              <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {showWhatsApp && (
                  <p className="flex items-center gap-1.5">
                    <MessageCircle size={13} className="text-emerald-600" />
                    <span className="font-medium">WhatsApp:</span>{' '}
                    {cari.telefon ? formatPhoneDisplay(cari.telefon) : '—'}
                  </p>
                )}
                {showEmail && (
                  <p className="flex items-center gap-1.5">
                    <Mail size={13} className="text-brand-600" />
                    <span className="font-medium">E-posta:</span>{' '}
                    {cari.email_adresleri.join(', ') || '—'}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Gidecek mesaj (göndermeden önce düzenleyebilirsiniz)
                </label>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={12}
                  disabled={loading}
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {body.length} karakter · *yıldız* arasındaki metin WhatsApp&apos;ta kalın görünür.
                  {kanal === 'her-ikisi' && ' Aynı metin her iki kanala da gider.'}
                </p>
              </div>

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
                disabled={loading || !body.trim()}
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
