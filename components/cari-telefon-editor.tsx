'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, LoaderCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatPhoneDisplay,
  normalizePhone,
  PHONE_INPUT_HINT,
  PHONE_INPUT_PLACEHOLDER,
} from '@/lib/phone'
import type { TelefonAday } from '@/lib/types'

export function CariTelefonEditor({
  cariKod,
  initialPhones,
  candidates,
}: {
  cariKod: string
  initialPhones: string[]
  candidates: TelefonAday[]
}) {
  const router = useRouter()
  const initialDisplay = useMemo(
    () => initialPhones.map((p) => formatPhoneDisplay(p)).join('; '),
    [initialPhones]
  )
  const [value, setValue] = useState(initialDisplay)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [visibleCandidates, setVisibleCandidates] = useState(candidates)

  const preview = useMemo(() => {
    const parts = value
      .split(/[;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    return parts.map((part) => {
      const normalized = normalizePhone(part)
      return normalized ? formatPhoneDisplay(normalized) : part
    })
  }, [value])

  async function save() {
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/hatirlatma/cari-telefon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, telefon: value }),
      })
      const result = (await response.json()) as {
        success?: boolean
        error?: string
        message?: string
        telefonlar?: string[]
        display?: string[]
      }
      if (!response.ok || !result.success) throw new Error(result.error || 'Kaydedilemedi.')
      const saved = result.display || []
      setValue(saved.join('; '))
      setVisibleCandidates((items) =>
        items.filter((item) => !(result.telefonlar || []).includes(item.telefon))
      )
      setMessage(result.message || 'Kaydedildi.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  function useCandidate(telefon: string) {
    const display = formatPhoneDisplay(telefon)
    const current = value
      .split(/[;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!current.includes(display)) current.push(display)
    setValue(current.join('; '))
    setMessage('')
    setError('')
  }

  async function dismissCandidate(telefon: string) {
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/hatirlatma/telefon-aday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, telefon }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Aday gizlenemedi.')
      setVisibleCandidates((items) => items.filter((item) => item.telefon !== telefon))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aday gizlenemedi.')
    }
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setMessage('')
            setError('')
          }}
          placeholder={PHONE_INPUT_PLACEHOLDER}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Button
          onClick={save}
          disabled={loading}
          className="shrink-0 px-3 py-2 text-xs"
        >
          {loading ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={15} />}
          Kaydet
        </Button>
      </div>

      <p className="mt-1.5 text-xs text-slate-500">{PHONE_INPUT_HINT}</p>

      {preview.length > 0 && value.trim() && (
        <p className="mt-1 text-xs text-slate-600">
          Kayıt önizleme: {preview.join(' · ')}
        </p>
      )}

      {visibleCandidates.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleCandidates.slice(0, 5).map((candidate) => (
            <span
              key={candidate.telefon}
              className="inline-flex items-center overflow-hidden rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800"
            >
              <button
                type="button"
                onClick={() => useCandidate(candidate.telefon)}
                title={`${candidate.kaynak} · kullanmak için tıklayın`}
                className="px-2 py-1 text-left hover:bg-amber-100"
              >
                + {formatPhoneDisplay(candidate.telefon)}
              </button>
              <button
                type="button"
                onClick={() => dismissCandidate(candidate.telefon)}
                title="Bu öneriyi kalıcı olarak gizle"
                aria-label={`${formatPhoneDisplay(candidate.telefon)} önerisini gizle`}
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
