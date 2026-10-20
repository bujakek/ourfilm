'use client'

import { Switch, type SwitchTone } from '@/components/ui/switch'
import type { Locale } from '@/lib/i18n'

export function PostEventUploadsField({
  enabled,
  onChange,
  disabled,
  locale,
  tone = 'default',
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
  locale: Locale
  /** `host` is the settings row in the landing look. */
  tone?: SwitchTone
}) {
  const en = locale === 'en'
  const host = tone === 'host'
  const title = en ? 'After-event uploads' : 'Utólagos képfeltöltés'
  return (
    <div
      className={`flex items-center justify-between gap-4 ${host ? 'min-h-[72px]' : ''}`}
    >
      <div className="min-w-0">
        <p
          className={
            host
              ? 'text-[16px] leading-[1.5] font-medium text-white'
              : 'text-sm font-medium'
          }
        >
          {title}
        </p>
        <p
          className={
            host
              ? 'text-[14px] leading-[1.5] text-pretty text-white/65'
              : 'mt-1 text-xs leading-relaxed text-muted-foreground'
          }
        >
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
        tone={tone}
      />
    </div>
  )
}
