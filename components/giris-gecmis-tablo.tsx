import { CheckCircle2, KeyRound, ShieldAlert, XCircle } from 'lucide-react'
import type { GirisKaydi } from '@/lib/giris-gecmis'

function tarih(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GirisGecmisTablo({
  kayitlar,
  kullaniciGoster = false,
  bosMesaj,
}: {
  kayitlar: GirisKaydi[]
  kullaniciGoster?: boolean
  bosMesaj: string
}) {
  if (!kayitlar.length) {
    return <p className="px-1 py-3 text-sm text-slate-400">{bosMesaj}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">Tarih</th>
            {kullaniciGoster && <th className="px-3 py-2">Kullanıcı</th>}
            <th className="px-3 py-2">Adım</th>
            <th className="px-3 py-2">IP</th>
            <th className="px-3 py-2">Sonuç</th>
          </tr>
        </thead>
        <tbody>
          {kayitlar.map((k, i) => (
            <tr key={k.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">
                {tarih(k.created_at)}
              </td>
              {kullaniciGoster && (
                <td className="px-3 py-2 text-slate-700">{k.kullanici || '—'}</td>
              )}
              <td className="px-3 py-2">
                {k.tur === 'kod' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700">
                    <KeyRound size={12} /> Doğrulama kodu
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-600">Şifre</span>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{k.ip || '—'}</td>
              <td className="px-3 py-2">
                {k.basarili ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={13} /> Başarılı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                    <XCircle size={13} /> Başarısız
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SupheliUyari({ adet }: { adet: number }) {
  if (adet === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
      <span>
        Hesabınızda son 30 günde <strong>{adet} başarısız giriş denemesi</strong> var. Siz
        değilseniz şifrenizi değiştirin ve bilgi işleme bildirin.
      </span>
    </div>
  )
}
