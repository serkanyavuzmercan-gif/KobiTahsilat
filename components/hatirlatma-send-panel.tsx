'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHatirlatmaMessage } from '@/components/hatirlatma-message-context'
import { formatPhoneDisplay } from '@/lib/phone'

export function HatirlatmaSendPanel({
  cariKod,
  hasPhone,
  isMobile,
  sendBlocked,
  blockedUntil,
  sendEnabled,
  gonderimSayisi,
}: {
  cariKod: string
  hasPhone: boolean
  isMobile: boolean
  sendBlocked: boolean
  blockedUntil: string | null
  sendEnabled: boolean
  gonderimSayisi: number
}) {
  const router = useRouter()
  const { body: messageBody } = useHatirlatmaMessage()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canSend = sendEnabled && hasPhone && isMobile && !sendBlocked && messageBody.trim().length > 0

  async function sendMessage() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/hatirlatma/whatsapp-gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, messageBody: messageBody.trim() }),
      })
      const result = (await response.json()) as {
        success?: boolean
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
      setMessage(result.message || 'Mesaj gönderildi.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (!sendEnabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        WhatsApp gönderimi kapalı. Yönetici `WHATSAPP_SEND_ENABLED=true` ile etkinleştirebilir.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Daha önce gönderilen: <strong>{gonderimSayisi}</strong> mesaj
      </p>

      <Button
        variant="success"
        onClick={sendMessage}
        disabled={!canSend || loading}
        className="w-full"
      >
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
        WhatsApp gönder
      </Button>

      {!hasPhone && <p className="text-xs text-red-600">Gönderim için cep telefonu gerekli.</p>}
      {hasPhone && messageBody.trim().length === 0 && (
        <p className="text-xs text-red-600">Mesaj metni boş olamaz.</p>
      )}
      {hasPhone && !isMobile && (
        <p className="text-xs text-amber-700">
          WhatsApp için cep telefonu girin (05… ile başlamalı).
        </p>
      )}
      {sendBlocked && blockedUntil && (
        <p className="text-xs text-amber-700">
          Tekrar gönderim: {new Date(blockedUntil).toLocaleDateString('tr-TR')}
        </p>
      )}
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function HatirlatmaPhoneStatus({
  telefon,
  telefonKaynagi,
  hasCandidate,
}: {
  telefon: string | null
  telefonKaynagi?: string | null
  hasCandidate: boolean
}) {
  if (telefon) {
    return (
      <div>
        <p className="font-medium text-slate-800">{formatPhoneDisplay(telefon)}</p>
        <p className="mt-1 text-xs text-emerald-700">
          {telefonKaynagi || 'Kayıtlı'} · gönderime hazır
        </p>
      </div>
    )
  }
  if (hasCandidate) {
    return (
      <div>
        <p className="text-slate-500">—</p>
        <p className="mt-1 text-xs text-amber-700">Telefon adayı var · önizlemede düzenleyin</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-slate-500">—</p>
      <p className="mt-1 text-xs text-red-600">Telefon bulunamadı</p>
    </div>
  )
}
