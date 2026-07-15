'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHatirlatmaMessage } from '@/components/hatirlatma-message-context'
import { WHATSAPP_SENDER_LABEL } from '@/lib/whatsapp-constants'
import { formatPhoneDisplay } from '@/lib/phone'

export function HatirlatmaSendPanel({
  cariKod,
  hasPhone,
  isMobile,
  sendEnabled,
  gonderimSayisi,
}: {
  cariKod: string
  hasPhone: boolean
  isMobile: boolean
  sendEnabled: boolean
  gonderimSayisi: number
}) {
  const router = useRouter()
  const { body: messageBody } = useHatirlatmaMessage()
  const [loading, setLoading] = useState(false)
  const [sentCount, setSentCount] = useState(gonderimSayisi)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
    providerId?: string | null
  } | null>(null)

  const canSend = sendEnabled && hasPhone && isMobile && messageBody.trim().length > 0

  async function sendMessage() {
    setLoading(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/hatirlatma/whatsapp-gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, messageBody: messageBody.trim() }),
      })
      const raw = await response.text()
      let result: {
        success?: boolean
        error?: string
        message?: string
        providerId?: string | null
      } = {}
      try {
        result = JSON.parse(raw) as typeof result
      } catch {
        throw new Error(`Sunucu yanıtı okunamadı (${response.status}). Oturum süreniz dolmuş olabilir.`)
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
      setSentCount((count) => count + 1)
      setFeedback({
        type: 'success',
        text: result.message || 'Mesaj gönderildi.',
        providerId: result.providerId,
      })
      router.refresh()
    } catch (cause) {
      setFeedback({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'Gönderilemedi.',
      })
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
        Gönderen: <strong>{WHATSAPP_SENDER_LABEL}</strong>
      </p>
      <p className="text-xs text-slate-500">
        Daha önce gönderilen: <strong>{sentCount}</strong> mesaj
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
      {feedback?.type === 'success' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-medium">{feedback.text}</p>
              {feedback.providerId ? (
                <p className="mt-1 break-all text-xs text-emerald-800">
                  Meta mesaj kimliği: {feedback.providerId}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-emerald-800">
                WhatsApp uygulamanızda <strong>Hidroteknik</strong> iş hattından gelen sohbeti kontrol edin.
              </p>
            </div>
          </div>
        </div>
      )}
      {feedback?.type === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 shrink-0" size={18} />
            <p>{feedback.text}</p>
          </div>
        </div>
      )}
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
