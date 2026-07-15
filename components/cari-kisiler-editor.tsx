'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Plus, Save, Trash2, UserPlus } from 'lucide-react'
import type { CariKisi } from '@/lib/cari-kisiler'

type Draft = { ad_soyad: string; unvan: string; telefon: string; email: string }

function KisiRow({
  kisi,
  cariKod,
  onDeleted,
}: {
  kisi: CariKisi
  cariKod: string
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [d, setD] = useState<Draft>({
    ad_soyad: kisi.ad_soyad,
    unvan: kisi.unvan || '',
    telefon: kisi.telefon || '',
    email: kisi.email || '',
  })
  const [busy, setBusy] = useState<'save' | 'del' | null>(null)
  const [msg, setMsg] = useState('')

  async function kaydet() {
    setBusy('save')
    setMsg('')
    try {
      const res = await fetch('/api/cari-kisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kisi.id, ...d }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Kaydedilemedi.')
      setMsg('✓')
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(null)
    }
  }

  async function sil() {
    if (!confirm(`${kisi.ad_soyad} kişisini silmek istiyor musunuz?`)) return
    setBusy('del')
    try {
      const res = await fetch('/api/cari-kisi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kisi.id }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Silinemedi.')
      onDeleted(kisi.id)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Hata')
      setBusy(null)
    }
  }

  const inp = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500'
  return (
    <tr className="align-top">
      <td className="px-2 py-1.5"><input className={inp} value={d.ad_soyad} onChange={(e) => setD({ ...d, ad_soyad: e.target.value })} placeholder="Ad soyad" /></td>
      <td className="px-2 py-1.5"><input className={inp} value={d.unvan} onChange={(e) => setD({ ...d, unvan: e.target.value })} placeholder="Rol (ör. Muhasebe)" /></td>
      <td className="px-2 py-1.5"><input className={inp} value={d.telefon} onChange={(e) => setD({ ...d, telefon: e.target.value })} placeholder="+90 5xx…" /></td>
      <td className="px-2 py-1.5"><input className={inp} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="e-posta" /></td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right">
        <button type="button" onClick={kaydet} disabled={busy !== null} title="Kaydet" className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 disabled:opacity-40">
          {busy === 'save' ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
        </button>
        <button type="button" onClick={sil} disabled={busy !== null} title="Sil" className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-40">
          {busy === 'del' ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
        </button>
        {msg && <span className="ml-1 text-xs text-slate-500">{msg}</span>}
      </td>
    </tr>
  )
}

export function CariKisilerEditor({ cariKod, kisiler }: { cariKod: string; kisiler: CariKisi[] }) {
  const router = useRouter()
  const [list, setList] = useState(kisiler)
  const [yeni, setYeni] = useState<Draft>({ ad_soyad: '', unvan: '', telefon: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function ekle() {
    if (!yeni.ad_soyad.trim()) {
      setErr('Ad soyad gerekli.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/cari-kisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, ...yeni }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string; id?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Eklenemedi.')
      setList((l) => [...l, { id: String(r.id), ad_soyad: yeni.ad_soyad, unvan: yeni.unvan || null, telefon: yeni.telefon || null, email: yeni.email || null }])
      setYeni({ ad_soyad: '', unvan: '', telefon: '', email: '' })
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  const inp = 'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500'
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-2">Ad soyad</th>
            <th className="px-2 py-2">Rol / açıklama</th>
            <th className="px-2 py-2">Telefon</th>
            <th className="px-2 py-2">E-posta</th>
            <th className="px-2 py-2 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {list.map((k) => (
            <KisiRow key={k.id} kisi={k} cariKod={cariKod} onDeleted={(id) => { setList((l) => l.filter((x) => x.id !== id)); router.refresh() }} />
          ))}
          {list.length === 0 && (
            <tr><td colSpan={5} className="px-2 py-3 text-sm text-slate-400">Tanımlı kişi yok. Aşağıdan ekleyebilirsiniz.</td></tr>
          )}
          {/* Yeni kişi satırı */}
          <tr className="border-t border-slate-200 bg-slate-50 align-top">
            <td className="px-2 py-1.5"><input className={inp} value={yeni.ad_soyad} onChange={(e) => setYeni({ ...yeni, ad_soyad: e.target.value })} placeholder="Ad soyad" /></td>
            <td className="px-2 py-1.5"><input className={inp} value={yeni.unvan} onChange={(e) => setYeni({ ...yeni, unvan: e.target.value })} placeholder="Rol (ör. Muhasebe)" /></td>
            <td className="px-2 py-1.5"><input className={inp} value={yeni.telefon} onChange={(e) => setYeni({ ...yeni, telefon: e.target.value })} placeholder="+90 5xx…" /></td>
            <td className="px-2 py-1.5"><input className={inp} value={yeni.email} onChange={(e) => setYeni({ ...yeni, email: e.target.value })} placeholder="e-posta" /></td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right">
              <button type="button" onClick={ekle} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}
                Ekle
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {err && <p className="mt-1 px-2 text-xs text-red-600">{err}</p>}
      <p className="mt-2 flex items-center gap-1.5 px-2 text-xs text-slate-400">
        <UserPlus size={13} /> Değişiklikler kalıcıdır (ortak <strong>cari_kisiler</strong> tablosuna yazılır; crm/ss de görür).
      </p>
    </div>
  )
}
