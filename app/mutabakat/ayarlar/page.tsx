import { BackLink } from '@/components/ui/button'
import { MailSenderSettings } from '@/components/mail-sender-settings'

export const dynamic = 'force-dynamic'

export default function MutabakatAyarlarPage() {
  return (
    <div className="space-y-5">
      <BackLink href="/mutabakat">Mutabakat listesine dön</BackLink>
      <MailSenderSettings />
    </div>
  )
}
