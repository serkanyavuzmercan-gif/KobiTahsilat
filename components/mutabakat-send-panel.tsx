'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MutabakatSendPanel({
  cariKod,
  hasRecipient,
  sendBlocked,
  blockedUntil,
  sendEnabled,
}: {
  cariKod: string
  hasRecipient: boolean
  sendBlocked: boolean
  blockedUntil: string | null
  sendEnabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canSend = sendEnabled && hasRecipient && !sendBlocked

  async function sendMutabakat() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod }),
      })
      const result = (await response.json()) as {
        success?: boolean
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderilemedi.')
      setMessage(result.message || 'Mutabakat gönderildi.')
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
        Gönderim şu anda kapalı. Yönetici onayından sonra etkinleştirilecek.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={sendMutabakat}
        disabled={!canSend || loading}
        title={
          !hasRecipient
            ? 'Alıcı e-postası gerekli'
            : sendBlocked
              ? '8 iş günü bekleme süresi aktif'
              : undefined
        }
        className="w-full"
      >
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
        Mutabakat gönder
      </Button>

      {!hasRecipient && (
        <p className="text-xs text-red-600">Gönderim için doğrulanmış alıcı e-postası gerekli.</p>
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
