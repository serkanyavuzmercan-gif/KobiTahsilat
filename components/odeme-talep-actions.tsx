'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, Mail, MessageCircle } from 'lucide-react'

type Kanal = 'whatsapp' | 'email' | 'her-ikisi'

async function postGonder(url: string, cariKod: string): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cariKod }),
  })
  const result = (await response.json()) as { success?: boolean; error?: string; message?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
  return result.message || 'Gönderildi.'
}

export function OdemeTalepActions({
  cariKod,
  hasPhone,
  hasEmail,
  sendEnabled,
}: {
  cariKod: string
  hasPhone: boolean
  hasEmail: boolean
  sendEnabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<Kanal | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function gonder(kanal: Kanal) {
    setLoading(kanal)
    setMessage('')
    setError('')
    try {
      const mesajlar: string[] = []
      if (kanal === 'whatsapp' || kanal === 'her-ikisi') {
        mesajlar.push(await postGonder('/api/hatirlatma/whatsapp-gonder', cariKod))
      }
      if (kanal === 'email' || kanal === 'her-ikisi') {
        mesajlar.push(await postGonder('/api/hatirlatma/email-gonder', cariKod))
      }
      setMessage(mesajlar.join(' '))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderilemedi.')
    } finally {
      setLoading(null)
    }
  }

  if (!sendEnabled) {
    return <span className="text-xs text-amber-700">Gönderim kapalı</span>
  }

  const busy = loading !== null
  const btnBase =
    'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-nowrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => gonder('whatsapp')}
          disabled={busy || !hasPhone}
          title={hasPhone ? 'WhatsApp ile ödeme talebi gönder' : 'Kayıtlı cep telefonu yok'}
          className={`${btnBase} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
        >
          {loading === 'whatsapp' ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <MessageCircle size={13} />
          )}
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => gonder('email')}
          disabled={busy || !hasEmail}
          title={hasEmail ? 'E-posta ile ödeme talebi gönder' : 'Doğrulanmış e-posta yok'}
          className={`${btnBase} bg-brand-50 text-brand-700 hover:bg-brand-100`}
        >
          {loading === 'email' ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <Mail size={13} />
          )}
          E-posta
        </button>
        <button
          type="button"
          onClick={() => gonder('her-ikisi')}
          disabled={busy || !hasPhone || !hasEmail}
          title={
            hasPhone && hasEmail
              ? 'Hem WhatsApp hem e-posta ile gönder'
              : 'Her ikisi için telefon ve e-posta gerekli'
          }
          className={`${btnBase} bg-slate-800 text-white hover:bg-slate-900`}
        >
          {loading === 'her-ikisi' ? (
            <LoaderCircle size={13} className="animate-spin" />
          ) : (
            <CheckCircle2 size={13} />
          )}
          Her ikisi
        </button>
      </div>
      {message && <p className="max-w-[260px] text-right text-[11px] leading-tight text-emerald-700">{message}</p>}
      {error && <p className="max-w-[260px] text-right text-[11px] leading-tight text-red-600">{error}</p>}
    </div>
  )
}
