'use client'

import {
  HOST_ROW_DETAIL,
  HOST_ROW_QUESTION,
} from '@/components/host/ui/classes'
import { Switch } from '@/components/ui/switch'
import type { Locale } from '@/lib/i18n'

export function PostEventUploadsField({
  enabled,
  onChange,
  disabled,
  locale,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
  locale: Locale
}) {
  const en = locale === 'en'
  const title = en ? 'After-event uploads' : 'Utólagos képfeltöltés'
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={HOST_ROW_QUESTION}>{title}</p>
        <p className={HOST_ROW_DETAIL}>
          {en
            ? 'Guests can add photos from their phones for 24 hours after the event, using their remaining shots.'
            : 'A vendégek az esemény után még 24 órán át hozzáadhatnak képeket a telefonjukról, a megmaradt képkeretet felhasználva.'}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled}
        label={title}
      />
    </div>
  )
}
