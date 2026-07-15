'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { formatTL } from '@/lib/types'

export function MutabakatOnayForm({
  token,
  firmaAdi,
  cariKod,
  bakiye,
  mutabakatTarihi,
  itirazUrl,
}: {
  token: string
  firmaAdi: string
  cariKod: string
  bakiye: number
  mutabakatTarihi: string
  itirazUrl: string
}) {
  const [aciklama, setAciklama] = useState('')
  const [iletisim, setIletisim] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/mutabakat/onay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, aciklama: aciklama.trim(), iletisim: iletisim.trim() }),
      })
      const result = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !result.success) throw new Error(result.error || 'Onay gönderilemedi.')
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Onay gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-emerald-600" size={52} />
        <h2 className="mt-4 text-2xl font-semibold">Onayınız alındı</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          Bakiyeyi mutabık olarak onayladığınız <strong>Hidroteknik A.Ş.</strong> ekibine
          iletildi. Teşekkür ederiz.
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm text-slate-400">
          Bu pencereyi güvenle kapatabilirsiniz.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
          Cari hesap mutabakatı
        </p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck size={24} className="text-emerald-600" />
          Bakiye onayı
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Aşağıdaki bakiyenin kayıtlarınızla mutabık (doğru) olduğunu onaylıyorsunuz. Bir farklılık
          varsa lütfen bunun yerine{' '}
          <Link href={itirazUrl} className="font-medium text-brand-600 hover:underline">
            fark / itiraz bildirin
          </Link>
          .
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-3">
          <Info label="Firma" value={firmaAdi} />
          <Info label="Cari kod" value={cariKod} />
          <Info label="Onaylanan bakiye" value={formatTL(bakiye)} />
        </div>
        <p className="mt-2 text-xs text-slate-400">Mutabakat tarihi: {mutabakatTarihi}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            {error}
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Not (isteğe bağlı)</span>
          <textarea
            value={aciklama}
            onChange={(event) => setAciklama(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Eklemek istediğiniz bir not varsa yazabilirsiniz…"
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">İletişim bilgisi (isteğe bağlı)</span>
          <input
            value={iletisim}
            onChange={(event) => setIletisim(event.target.value)}
            maxLength={250}
            placeholder="E-posta veya telefon"
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" />

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={20} />
          ) : (
            <>
              <ShieldCheck size={18} />
              Evet, bakiyeyi onaylıyorum
            </>
          )}
        </button>
      </section>
    </form>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
