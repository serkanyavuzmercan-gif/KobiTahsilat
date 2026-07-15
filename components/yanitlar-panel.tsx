'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Mail, MessageCircle } from 'lucide-react'
import { CariYanitIcon } from '@/components/cari-yanit-icon'
import { YanitDetailModal } from '@/components/yanit-detail-modal'
import { EmptyTableRow } from '@/components/ui/summary-stat'
import type { CariYanitKayit } from '@/lib/types'

type Filter = 'all' | 'email' | 'whatsapp' | 'unread'

export function YanitlarPanel({
  inbox,
  onMarkedRead,
}: {
  inbox: CariYanitKayit[]
  onMarkedRead: (yanitIds: string[]) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<{
    kanal: 'email' | 'whatsapp'
    yanitlar: CariYanitKayit[]
    title: string
    cariKod: string
  } | null>(null)

  const filtered = useMemo(() => {
    return inbox.filter((item) => {
      if (filter === 'email') return item.kanal === 'email'
      if (filter === 'whatsapp') return item.kanal === 'whatsapp'
      if (filter === 'unread') return !item.okundu
      return true
    })
  }, [filter, inbox])

  const unreadTotal = inbox.filter((item) => !item.okundu).length

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'unread', label: `Okunmamış (${unreadTotal})` },
    { id: 'email', label: 'E-posta' },
    { id: 'whatsapp', label: 'WhatsApp' },
  ]

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-xl font-semibold">Müşteri yanıtları</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mutabakat itirazları ve WhatsApp geri dönüşleri. Okunmamış yanıtlar listede vurgulanır.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === item.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="table-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Özet</th>
                <th className="px-4 py-3 text-right">Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyTableRow colSpan={5} message="Bu filtrede yanıt bulunamadı." />
              ) : (
                filtered.map((yanit) => (
                  <tr
                    key={yanit.id}
                    className={`cursor-pointer ${!yanit.okundu ? 'bg-brand-50/30' : ''}`}
                    onClick={() =>
                      setSelected({
                        kanal: yanit.kanal,
                        yanitlar: inbox.filter(
                          (item) => item.cari_kod === yanit.cari_kod && item.kanal === yanit.kanal
                        ),
                        title: yanit.firma_adi,
                        cariKod: yanit.cari_kod,
                      })
                    }
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {new Date(yanit.tarih).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                          yanit.kanal === 'email'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {yanit.kanal === 'email' ? (
                          <Mail size={12} />
                        ) : (
                          <MessageCircle size={12} />
                        )}
                        {yanit.kanal === 'email' ? 'E-posta' : 'WhatsApp'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cariler/${encodeURIComponent(yanit.cari_kod)}`}
                        className="font-medium hover:text-brand-700"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {yanit.firma_adi}
                      </Link>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">{yanit.cari_kod}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p className="line-clamp-2">{yanit.ozet}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!yanit.okundu ? (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                          Yeni
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Okundu</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <YanitDetailModal
          open
          onClose={() => setSelected(null)}
          title={selected.title}
          kanal={selected.kanal}
          yanitlar={selected.yanitlar}
          cariKod={selected.cariKod}
          onMarkedRead={(ids) => {
            onMarkedRead(ids)
            setSelected(null)
          }}
        />
      ) : null}
    </div>
  )
}
