'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Mail, Plus, Star, Trash2 } from 'lucide-react'
import type { MailSenderAccount } from '@/lib/types'

export function MailSenderSettings() {
  const [senders, setSenders] = useState<MailSenderAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [adSoyad, setAdSoyad] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadSenders() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici')
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Göndericiler yüklenemedi.')
      setSenders(result.senders || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Göndericiler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSenders()
  }, [])

  async function connectSender() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adSoyad }),
      })
      const result = (await response.json()) as {
        success?: boolean
        sender?: MailSenderAccount
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Bağlantı kurulamadı.')
      setEmail('')
      setAdSoyad('')
      setMessage(result.message || 'Gönderici bağlandı.')
      await loadSenders()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bağlantı kurulamadı.')
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(id: string) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, varsayilan: true }),
      })
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Varsayılan güncellenemedi.')
      setSenders(result.senders || [])
      setMessage(result.message || 'Varsayılan gönderici güncellendi.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Varsayılan güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function removeSender(id: string) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/gonderici', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = (await response.json()) as {
        success?: boolean
        senders?: MailSenderAccount[]
        error?: string
        message?: string
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Gönderici kaldırılamadı.')
      setSenders(result.senders || [])
      setMessage(result.message || 'Gönderici kaldırıldı.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gönderici kaldırılamadı.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
            <Mail size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Gönderici e-posta bağlantıları</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mutabakat e-postalarının hangi adresten gönderileceğini burada bağlayın. Seçilen gönderici
          önizleme ekranında kullanılır.
        </p>
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <p className="font-medium">Gmail / Google Workspace nasıl çalışır?</p>
          <p className="mt-1 leading-relaxed">
            Bu ekranda Gmail hesabınıza doğrudan giriş yapılmaz. Gönderim{' '}
            <strong>Resend</strong> servisi üzerinden yapılır; bağladığınız{' '}
            <strong>@hidroteknik.com.tr</strong> adresi gönderici (From) olarak kullanılır.
            Alan adının Resend panelinde DNS ile doğrulanmış olması gerekir (SPF/DKIM).
            Yanıtlar oturum açtığınız e-posta adresine yönlendirilir.
          </p>
        </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@hidroteknik.com.tr"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            value={adSoyad}
            onChange={(event) => setAdSoyad(event.target.value)}
            placeholder="Görünen ad (opsiyonel)"
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={connectSender}
            disabled={saving || !email.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
            Bağla
          </button>
        </div>

        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold">Bağlı göndericiler</h3>
          <p className="mt-1 text-xs text-slate-500">
            Sistem varsayılanı (MAIL_FROM) ve sizin bağladığınız adresler listelenir.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
            <LoaderCircle className="animate-spin" size={18} />
            Yükleniyor…
          </div>
        ) : senders.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Henüz bağlı gönderici yok.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {senders.map((sender) => (
              <div
                key={sender.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {sender.ad_soyad ? `${sender.ad_soyad} <${sender.email}>` : sender.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {sender.sistem ? 'Sistem varsayılanı' : 'Kullanıcı bağlantısı'}
                    {sender.varsayilan ? ' · Varsayılan gönderici' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!sender.varsayilan && (
                    <button
                      type="button"
                      onClick={() => makeDefault(sender.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Star size={14} />
                      Varsayılan yap
                    </button>
                  )}
                  {!sender.sistem && (
                    <button
                      type="button"
                      onClick={() => removeSender(sender.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 size={14} />
                      Kaldır
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
