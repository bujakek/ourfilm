'use client'

import { useOptimistic, useTransition } from 'react'
import { setPostEventUploads } from '@/app/(product)/host/events/[slug]/actions'
import { useSettingsSave } from '@/components/host/settings-save'
import { HOST_PANEL } from '@/components/host/ui/classes'
import { PostEventUploadsField } from './post-event-uploads-field'
import type { Locale } from '@/lib/i18n'

export function PostEventUploadsCard({
  slug,
  enabled,
  locale,
}: {
  slug: string
  enabled: boolean
  locale: Locale
}) {
  const [pending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(enabled)
  const { report } = useSettingsSave()

  const apply = (value: boolean) =>
    startTransition(async () => {
      setOptimistic(value)
      try {
        await setPostEventUploads(slug, value)
        report('ok', () => apply(value))
      } catch {
        report('error', () => apply(value))
      }
    })
  return (
    <section className={`${HOST_PANEL} px-5 py-2`}>
      <PostEventUploadsField
        enabled={optimistic}
        locale={locale}
        disabled={pending}
        onChange={apply}
        tone="host"
      />
    </section>
  )
}
