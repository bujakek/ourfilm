'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { setPostEventUploads } from '@/app/(product)/host/events/[slug]/actions'
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
  const [error, setError] = useState(false)
  return (
    <div className="glass rounded-2xl px-5 py-4">
      <PostEventUploadsField
        enabled={optimistic}
        locale={locale}
        disabled={pending}
        onChange={(value) => {
          startTransition(async () => {
            setError(false)
            setOptimistic(value)
            try {
              await setPostEventUploads(slug, value)
            } catch {
              setError(true)
            }
          })
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {locale === 'en'
            ? 'Could not save changes.'
            : 'Nem sikerült módosítani.'}
        </p>
      ) : null}
    </div>
  )
}
