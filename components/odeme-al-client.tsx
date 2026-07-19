'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, CreditCard, LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatTL } from '@/lib/types'

type CariMini = { cari_kod: string; firma_adi: string; bakiye: number; gecikmis_bakiye: number }

export function OdemeAlClient({ cariler, yapili }: { cariler: CariMini[]; yapili: boolean }) {
  const [q, setQ] = useState('')
  const [secili, setSecili] = useState<CariMini | null>(null)
  const [tutar, setTutar] = useState('')
  const [editable, setEditable] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sonuc, setSonuc] = useState<{ kisa_link: string; firma: string; tutar: number } | null>(null)
  const [hata, setHata] = useState('')
  const [kopyalandi, setKopyalandi] = useState(false)

  const liste = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr')
    const kaynak = t
      ? cariler.filter(
          (c) => c.firma_adi.toLocaleLowerCase('tr').includes(t) || c.cari_kod.includes(t)
        )
      : cariler
    return kaynak.slice(0, 50)
  }, [q, cariler])

  function sec(c: CariMini) {
    setSecili(c)
    setTutar(String(c.gecikmis_bakiye > 0 ? c.gecikmis_bakiye.toFixed(2) : c.bakiye.toFixed(2)))
    setSonuc(null)
    setHata('')
  }

  async function linkUret() {
    if (!secili) return
    setBusy(true)
    setHata('')
    setSonuc(null)
    try {
      const res = await fetch('/api/odeme/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cariKod: secili.cari_kod,
          tutar: Number(tutar.replace(',', '.')) || undefined,
          editable,
        }),
      })
      const j = (await res.json()) as {
        success?: boolean
        yapili?: boolean
        kisa_link?: string
        firma?: string
        tutar?: number
        error?: string
      }
      if (!j.success) throw new Error(j.error || 'Link oluşturulamadı.')
      setSonuc({ kisa_link: j.kisa_link!, firma: j.firma || secili.firma_adi, tutar: j.tutar || 0 })
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function kopyala() {
    if (!sonuc) return
    await navigator.clipboard.writeText(sonuc.kisa_link)
    setKopyalandi(true)
    setTimeout(() => setKopyalandi(false), 1500)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      {/* Cari seçimi */}
      <section className="card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Firma veya cari kod ara…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {liste.map((c) => (
            <li key={c.cari_kod}>
              <button
                type="button"
                onClick={() => sec(c)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  secili?.cari_kod === c.cari_kod
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="font-medium text-slate-800">{c.firma_adi}</p>
                <p className="flex justify-between text-xs text-slate-500">
                  <span className="font-mono">{c.cari_kod}</span>
                  <span className="text-red-600">Gecikmiş: {formatTL(c.gecikmis_bakiye)}</span>
                </p>
              </button>
            </li>
          ))}
          {liste.length === 0 && <li className="px-2 py-3 text-sm text-slate-400">Sonuç yok.</li>}
        </ul>
      </section>

      {/* Link üretimi */}
      <section className="card p-5">
        {!secili ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            Soldan bir cari seçin.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-mono text-slate-400">{secili.cari_kod}</p>
              <h3 className="text-lg font-semibold text-slate-900">{secili.firma_adi}</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Açık bakiye {formatTL(secili.bakiye)} · Gecikmiş{' '}
                <span className="text-red-600">{formatTL(secili.gecikmis_bakiye)}</span>
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-600">Tahsil edilecek tutar (₺)</span>
              <input
                value={tutar}
                onChange={(e) => setTutar(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Varsayılan gecikmiş tutar. Kısmi/farklı tahsilat için değiştirebilirsiniz.
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editable}
                onChange={(e) => setEditable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              Müşteri ödeme sayfasında tutarı değiştirebilsin
            </label>

            <Button variant="primary" onClick={linkUret} disabled={busy || !yapili}>
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <CreditCard size={16} />}
              Ödeme linki oluştur
            </Button>
            {!yapili && (
              <p className="text-xs text-amber-700">PayTR bağlı olmadığı için link üretilemiyor.</p>
            )}
            {hata && <p className="text-sm text-red-600">{hata}</p>}

            {sonuc && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-sm font-medium text-slate-800">
                  {sonuc.firma} · {formatTL(sonuc.tutar)} için ödeme linki hazır:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={sonuc.kisa_link}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
                  />
                  <Button variant="secondary" onClick={kopyala}>
                    {kopyalandi ? <Check size={15} /> : <Copy size={15} />}
                    {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Bu linki müşteriye gönder. Ödeme tamamlanınca sistemde “ödendi” olarak işaretlenir ve
                  o cari bir süre otomatik hatırlatmadan çıkarılır.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
