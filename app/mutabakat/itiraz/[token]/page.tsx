import Image from 'next/image'
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

  const cari = await getCari(payload.cariKod)
  if (!cari) notFound()

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image
          src="/hidroteknik-logo.png"
          alt="Hidroteknik A.Ş."
          width={200}
          height={42}
          className="h-11 w-auto object-contain"
          priority
        />
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
          Cari Hesap Mutabakatı
        </p>
      </div>
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
