'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LoaderCircle, Save } from 'lucide-react'
import type { EmailAday } from '@/lib/types'

export function CariEmailEditor({
  cariKod,
  initialEmails,
  candidates,
  compact = false,
}: {
  cariKod: string
  initialEmails: string[]
  candidates: EmailAday[]
  compact?: boolean
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialEmails.join('; '))
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [visibleCandidates, setVisibleCandidates] = useState(candidates)

  async function save() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/mutabakat/cari-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, emails: value }),
      })
      const result = (await response.json()) as {
        success?: boolean
        error?: string
        message?: string
        emails?: string[]
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Kaydedilemedi.')
      const savedEmails = result.emails || []
      setValue(savedEmails.join('; '))
      setVisibleCandidates((items) => items.filter((item) => !savedEmails.includes(item.email)))
      setMessage(result.message || 'Kaydedildi.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  function useCandidate(email: string) {
    const current = value
      .split(/[;,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!current.includes(email)) current.push(email)
    setValue(current.join('; '))
    setMessage('')
    setError('')
  }

  async function dismissCandidate(email: string) {
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/mutabakat/email-aday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, email }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Aday gizlenemedi.')
      setVisibleCandidates((items) => items.filter((item) => item.email !== email))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aday gizlenemedi.')
    }
  }

  return (
    <div className={compact ? 'min-w-72' : 'w-full'}>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setMessage('')
            setError('')
          }}
          placeholder="muhasebe@firma.com"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={15} />}
          <span className={compact ? 'hidden xl:inline' : ''}>Kaydet</span>
        </button>
      </div>

      {visibleCandidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleCandidates.slice(0, 5).map((candidate) => (
            <span
              key={candidate.email}
              className="inline-flex items-center overflow-hidden rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800"
            >
              <button
                type="button"
                onClick={() => useCandidate(candidate.email)}
                title={`${candidate.kaynak} · kullanmak için tıklayın`}
                className="px-2 py-1 text-left hover:bg-amber-100"
              >
                + {candidate.email}
              </button>
              <button
                type="button"
                onClick={() => dismissCandidate(candidate.email)}
                title="Bu öneriyi kalıcı olarak gizle"
                aria-label={`${candidate.email} önerisini gizle`}
                className="border-l border-amber-200 px-1.5 py-1 font-bold text-amber-700 hover:bg-amber-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {message && (
        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
          <Check size={13} /> {message}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
