'use client'

import { useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'

/**
 * Mutabakat listesinde satır-içi varsayılan alıcı seçici. Cari için keşfedilen tüm doğrulanmış
 * e-postalar chip olarak listelenir; kullanıcı tıklayarak varsayılan alıcı(lar)ı seçer.
 * Seçim KALICIDIR — `/api/mutabakat/cari-email` override'ını yazar; hem "Mutabakat Yap" detayı
 * hem de otomasyon bu varsayılanı kullanır. "Mutabakat Yap" düğmesine basmaya gerek yok.
 */
export function MutabakatEmailSecici({
  cariKod,
  havuz,
  secili: seciliInit,
}: {
  cariKod: string
  havuz: string[]
  secili: string[]
}) {
  const [secili, setSecili] = useState<string[]>(seciliInit)
  const [durum, setDurum] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function kaydet(next: string[]) {
    const onceki = secili
    setSecili(next)
    setDurum('saving')
    try {
      const res = await fetch('/api/mutabakat/cari-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, emails: next.join('; ') }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Kaydedilemedi.')
      setDurum('saved')
      window.setTimeout(() => setDurum('idle'), 1600)
    } catch {
      setSecili(onceki) // geri al
      setDurum('error')
    }
  }

  function toggle(email: string) {
    if (durum === 'saving') return
    const next = secili.includes(email)
      ? secili.filter((e) => e !== email)
      : [...secili, email]
    kaydet(next)
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {havuz.map((email) => {
          const on = secili.includes(email)
          return (
            <button
              key={email}
              type="button"
              onClick={() => toggle(email)}
              title={on ? 'Varsayılan alıcıdan çıkar' : 'Varsayılan alıcı yap'}
              className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                on
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                  on ? 'border-white bg-white/20' : 'border-slate-300'
                }`}
              >
                {on && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="truncate">{email}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-slate-500">
        {secili.length ? (
          <span className="text-emerald-700">
            {secili.length} alıcı seçili · gönderime hazır
          </span>
        ) : (
          <span className="text-amber-700">Alıcı seçili değil</span>
        )}
        {durum === 'saving' && (
          <span className="ml-1 inline-flex items-center gap-1 text-slate-400">
            <LoaderCircle size={11} className="animate-spin" /> kaydediliyor
          </span>
        )}
        {durum === 'saved' && <span className="ml-1 text-emerald-600">· kaydedildi ✓</span>}
        {durum === 'error' && <span className="ml-1 text-red-600">· kaydedilemedi</span>}
      </p>
    </div>
  )
}
