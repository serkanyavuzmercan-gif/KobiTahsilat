'use client'

import { useState } from 'react'
import { Check, LoaderCircle, Plus, X } from 'lucide-react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Mutabakat listesinde satır-içi alıcı yönetimi (detaya girmeden):
 *  - Keşfedilen tüm doğrulanmış e-postalar + adaylar chip olarak listelenir.
 *  - Tıkla → varsayılan alıcı seç/kaldır (kalıcı: /api/mutabakat/cari-email override).
 *  - Aday chip'ini seçmek onu doğrular + alıcı yapar.
 *  - Chip'teki ✕ → e-postayı KALICI siler (onaylı; cari_email_gizli → tüm görünümlerden düşer).
 *  - Alttaki kutu → yeni e-posta ekle (hiç e-postası olmayan cariye de).
 * Hem "Mutabakat Yap" detayı hem otomasyon bu varsayılanları kullanır.
 */
export function MutabakatEmailSecici({
  cariKod,
  havuz,
  adaylar = [],
  secili: seciliInit,
}: {
  cariKod: string
  havuz: string[]
  adaylar?: string[]
  secili: string[]
}) {
  const [secili, setSecili] = useState<string[]>(seciliInit)
  const [gizlenen, setGizlenen] = useState<string[]>([])
  const [eklenen, setEklenen] = useState<string[]>([])
  const [yeni, setYeni] = useState('')
  const [durum, setDurum] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const tumChipler = [...new Set([...havuz, ...adaylar, ...eklenen])].filter(
    (e) => !gizlenen.includes(e)
  )
  const adayMi = (email: string) =>
    adaylar.includes(email) && !havuz.includes(email) && !eklenen.includes(email)

  async function saveOverride(next: string[]) {
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
      setSecili(onceki)
      setDurum('error')
    }
  }

  function toggle(email: string) {
    if (durum === 'saving') return
    const next = secili.includes(email)
      ? secili.filter((e) => e !== email)
      : [...secili, email]
    saveOverride(next)
  }

  async function sil(email: string) {
    if (
      !window.confirm(
        `${email} adresini KALICI olarak silmek istiyor musunuz?\nBu adres bu cariden tamamen kaldırılır (Supabase).`
      )
    )
      return
    // Optimistik: chip'i gizle + seçiliyse çıkar.
    setGizlenen((g) => [...g, email])
    setSecili((s) => s.filter((e) => e !== email))
    setDurum('saving')
    try {
      const res = await fetch('/api/cari-email/gizle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, email }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Silinemedi.')
      setDurum('saved')
      window.setTimeout(() => setDurum('idle'), 1600)
    } catch {
      setGizlenen((g) => g.filter((e) => e !== email)) // geri getir
      setDurum('error')
    }
  }

  function ekle() {
    const email = yeni.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) {
      setDurum('error')
      return
    }
    setYeni('')
    if (!eklenen.includes(email)) setEklenen((l) => [...l, email])
    setGizlenen((g) => g.filter((e) => e !== email)) // daha önce silinmişse geri aç
    saveOverride([...new Set([...secili, email])])
  }

  return (
    <div className="space-y-1.5">
      {tumChipler.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tumChipler.map((email) => {
            const on = secili.includes(email)
            const aday = !on && adayMi(email)
            return (
              <span
                key={email}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2 pr-1 text-xs transition-colors ${
                  on
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : aday
                      ? 'border-dashed border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(email)}
                  title={on ? 'Varsayılan alıcıdan çıkar' : aday ? 'Adayı seç + doğrula' : 'Varsayılan alıcı yap'}
                  className="inline-flex min-w-0 items-center gap-1"
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                      on ? 'border-white bg-white/20' : aday ? 'border-amber-400' : 'border-slate-300'
                    }`}
                  >
                    {on && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{email}</span>
                  {aday && <span className="shrink-0 text-[9px] font-semibold uppercase">aday</span>}
                </button>
                <button
                  type="button"
                  onClick={() => sil(email)}
                  title="Bu adresi kalıcı sil"
                  className={`shrink-0 rounded-full p-0.5 ${
                    on ? 'hover:bg-white/20' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-1">
        <input
          type="email"
          value={yeni}
          onChange={(e) => setYeni(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ekle()
            }
          }}
          placeholder="Yeni e-posta ekle…"
          className="w-44 max-w-full rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={ekle}
          title="E-posta ekle"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-brand-200 bg-brand-50 px-1.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <Plus size={12} /> Ekle
        </button>
      </div>

      <p className="text-xs">
        {secili.length ? (
          <span className="text-emerald-700">{secili.length} alıcı seçili · gönderime hazır</span>
        ) : adaylar.length ? (
          <span className="text-amber-700">Alıcı seçin (adayları da seçebilirsiniz)</span>
        ) : tumChipler.length ? (
          <span className="text-amber-700">Alıcı seçili değil</span>
        ) : (
          <span className="text-red-600">E-posta yok — yukarıdan ekleyin</span>
        )}
        {durum === 'saving' && (
          <span className="ml-1 inline-flex items-center gap-1 text-slate-400">
            <LoaderCircle size={11} className="animate-spin" /> kaydediliyor
          </span>
        )}
        {durum === 'saved' && <span className="ml-1 text-emerald-600">· kaydedildi ✓</span>}
        {durum === 'error' && <span className="ml-1 text-red-600">· işlem başarısız</span>}
      </p>
    </div>
  )
}
