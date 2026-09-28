'use client'

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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
