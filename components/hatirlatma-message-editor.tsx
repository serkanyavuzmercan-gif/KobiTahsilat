'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHatirlatmaMessage } from '@/components/hatirlatma-message-context'

const MAX_LENGTH = 4096

export function HatirlatmaMessageEditor() {
  const { body, isEdited, setBody, reset } = useHatirlatmaMessage()

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-900">Müşterinin göreceği mesaj</p>
          <p className="text-xs text-emerald-700">
            Kibar ödeme hatırlatması · mutabakat metni değildir
            {isEdited ? ' · düzenlendi' : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={reset}
          disabled={!isEdited}
          className="shrink-0 px-3 py-2 text-xs"
        >
          <RotateCcw size={14} />
          Varsayılana dön
        </Button>
      </div>

      <div className="p-4">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_LENGTH}
          rows={14}
          spellCheck
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/30"
          aria-label="WhatsApp mesaj metni"
        />
        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Gönderimden önce metni burada düzenleyebilirsiniz. WhatsApp kalın yazı için{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5">*metin*</code> kullanın.
          </p>
          <p className={body.trim().length === 0 ? 'text-red-600' : ''}>
            {body.length.toLocaleString('tr-TR')} / {MAX_LENGTH.toLocaleString('tr-TR')} karakter
          </p>
        </div>
      </div>
    </section>
  )
}
