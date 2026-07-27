'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Mail, Phone, Plus, X } from 'lucide-react'

type Kind = 'email' | 'phone'

const CFG = {
  email: {
    Icon: Mail,
    baslik: 'E-posta',
    renk: 'brand',
    bos: 'Tanımlı e-posta yok',
    placeholder: 'ornek@firma.com',
    ekleEndpointKey: 'email' as const,
    gizleUrl: '/api/cari-email/gizle',
    gizleKey: 'email' as const,
    inputMode: 'email' as const,
  },
  phone: {
    Icon: Phone,
    baslik: 'WA Telefon Numarası',
    renk: 'emerald',
    bos: 'Tanımlı WA telefon numarası yok',
    placeholder: '0 5xx xxx xx xx',
    ekleEndpointKey: 'telefon' as const,
    gizleUrl: '/api/cari-telefon/gizle',
    gizleKey: 'telefon' as const,
    inputMode: 'tel' as const,
  },
}

/**
 * Cari detayında E-posta / Telefon kartı — belirgin ekle/sil.
 * `values`: gösterilecek ham değerler (ilk = varsayılan). `display`: gösterim metni (telefon formatı).
 * Ekleme: /api/cari-kisi POST (ad_soyad boş → '—', sadece kanal). Silme: gizle endpoint.
 */
export function CariKanalEditor({
  cariKod,
  kind,
  values,
  display,
}: {
  cariKod: string
  kind: Kind
  values: string[]
  display?: string[]
}) {
  const router = useRouter()
  const cfg = CFG[kind]
  const [list, setList] = useState(values)
  const [yeni, setYeni] = useState('')
  const [busy, setBusy] = useState(false)
  const [silinen, setSilinen] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const renkCls =
    cfg.renk === 'brand'
      ? { ikon: 'text-brand-600', rozet: 'bg-brand-100 text-brand-700', btn: 'bg-brand-600 hover:bg-brand-700', ring: 'focus:ring-brand-500' }
      : { ikon: 'text-emerald-600', rozet: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700', ring: 'focus:ring-emerald-500' }

  async function ekle() {
    const deger = yeni.trim()
    if (!deger) return
    setBusy(true)
    setErr('')
    try {
      const res = await fetch('/api/cari-kisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, [cfg.ekleEndpointKey]: deger }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Eklenemedi.')
      setList((l) => [...l, deger])
      setYeni('')
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hata')
    } finally {
      setBusy(false)
    }
  }

  async function sil(deger: string) {
    if (!confirm(`${deger} — bu ${cfg.baslik.toLowerCase()} bu cariden kaldırılsın mı?`)) return
    setSilinen(deger)
    setErr('')
    try {
      const res = await fetch(cfg.gizleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cariKod, [cfg.gizleKey]: deger }),
      })
      const r = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !r.success) throw new Error(r.error || 'Silinemedi.')
      setList((l) => l.filter((x) => x !== deger))
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSilinen(null)
    }
  }

  const { Icon } = cfg
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon size={13} className={renkCls.ikon} /> {cfg.baslik} ({list.length})
      </p>

      {list.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {list.map((deger, i) => (
            <li
              key={deger}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {display?.[i] ?? deger}
                {i === 0 && (
                  <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${renkCls.rozet}`}>
                    varsayılan
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => sil(deger)}
                disabled={silinen !== null}
                title="Kaldır"
                className="shrink-0 rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
              >
                {silinen === deger ? <LoaderCircle size={15} className="animate-spin" /> : <X size={15} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-red-600">{cfg.bos}</p>
      )}

      {/* Her zaman görünen belirgin ekleme alanı */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <input
          value={yeni}
          inputMode={cfg.inputMode}
          onChange={(e) => setYeni(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void ekle()
            }
          }}
          placeholder={cfg.placeholder}
          className={`min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 ${renkCls.ring}`}
        />
        <button
          type="button"
          onClick={ekle}
          disabled={busy || !yeni.trim()}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-40 ${renkCls.btn}`}
        >
          {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
          Ekle
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  )
}
