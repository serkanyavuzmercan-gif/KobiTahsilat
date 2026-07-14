import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MailSenderSettings } from '@/components/mail-sender-settings'

export const dynamic = 'force-dynamic'

export default function MutabakatAyarlarPage() {
  return (
    <div className="space-y-5">
      <Link
        href="/mutabakat"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft size={16} />
        Mutabakat listesine dön
      </Link>
      <MailSenderSettings />
    </div>
  )
}
