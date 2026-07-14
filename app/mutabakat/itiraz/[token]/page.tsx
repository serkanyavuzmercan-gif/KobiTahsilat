import { notFound } from 'next/navigation'
import { MutabakatItirazForm } from '@/components/mutabakat-itiraz-form'
import { getCari } from '@/lib/data'
import { formatDate } from '@/lib/mutabakat'
import { verifyMutabakatToken } from '@/lib/mutabakat-token'

export const dynamic = 'force-dynamic'

export default async function MutabakatItirazPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: encodedToken } = await params
  const token = decodeURIComponent(encodedToken)
  const payload = verifyMutabakatToken(token)
  if (!payload) notFound()

  const cari = getCari(payload.cariKod)
  if (!cari) notFound()

  return (
    <div className="mx-auto max-w-3xl py-6">
      <MutabakatItirazForm
        token={token}
        firmaAdi={cari.firma_adi}
        cariKod={cari.cari_kod}
        bakiye={payload.bakiye}
        mutabakatTarihi={formatDate(payload.snapshotTarihi)}
      />
    </div>
  )
}
