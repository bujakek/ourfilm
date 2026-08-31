'use client'

import type { ModerationTile } from '@/lib/photos'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useOptimistic, useState, useTransition } from 'react'
import { setPhotoHidden } from '@/app/(product)/host/events/[slug]/actions'

/**
 * Stands in for a real `hidden_at` until the server sends one back.
 *
 * Nothing here reads the value — the tile and the counter both ask only
 * whether it is null — and a constant keeps the `useOptimistic` reducer pure.
 * `new Date()` there would be a fresh value on every render of a function
 * React may call more than once.
 */
const OPTIMISTIC_HIDDEN = 'optimistic'

function Tile({
  photo,
  slug,
  onToggle,
  locale,
}: {
  photo: ModerationTile
  slug: string
  onToggle: (photoId: string) => void
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const hidden = photo.hidden_at !== null

  return (
    <li className="relative">
      <div
        className={cn(
          'relative aspect-square overflow-hidden rounded-2xl transition-opacity',
          hidden && 'opacity-35',
        )}
      >
        <Image
          // Signed server-side: the bucket is private, so the URL is a
          // short-lived capability rather than an address this component could
          // have built for itself.
          src={photo.thumbUrl}
          alt={
            en
              ? `Photo by ${photo.uploaderName}`
              : `${photo.uploaderName} fotója`
          }
          fill
          sizes="(max-width: 640px) 50vw, 200px"
          unoptimized
          className="object-cover"
        />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(false)
            // Before the await, so the tile flips on the same frame as the tap.
            // A host moderating an album does it in a run of a dozen taps, and
            // a round trip between each one turns that into a stutter. React
            // rolls this back on its own if the action throws.
            onToggle(photo.id)
            try {
              await setPhotoHidden(slug, photo.id, !hidden)
            } catch {
              setError(true)
            }
          })
        }
        aria-pressed={hidden}
        aria-label={
          hidden
            ? en
              ? 'Restore photo'
              : 'Kép visszaállítása'
            : en
              ? 'Hide photo'
              : 'Kép elrejtése'
        }
        // No spinner. The icon has already flipped, so a spinner on top of it
        // would be reporting on work the host has been told is done. The dimmed
        // state is enough to say the tap landed and is still settling.
        className="glass-strong absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full text-foreground transition-opacity disabled:opacity-70"
      >
        {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>

      {error ? (
        <p className="mt-1 text-xs text-destructive">
          {en ? 'Failed' : 'Nem sikerült'}
        </p>
      ) : null}
      {hidden ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {en ? 'Hidden' : 'Rejtve'}
        </p>
      ) : null}
    </li>
  )
}

export function ModerationGrid({
  photos,
  slug,
  locale,
}: {
  photos: ModerationTile[]
  slug: string
  locale: 'en' | 'hu'
}) {
  // Held for the whole grid rather than per tile so the "N rejtve" counter
  // moves with the tile it describes. Per-tile state would flip the photo
  // instantly and leave the count a round trip behind, which reads as a bug.
  const [items, toggle] = useOptimistic(photos, (state, photoId: string) =>
    state.map((p) =>
      p.id === photoId
        ? { ...p, hidden_at: p.hidden_at ? null : OPTIMISTIC_HIDDEN }
        : p,
    ),
  )

  if (items.length === 0) {
    return (
      <p className="glass rounded-2xl px-5 py-6 text-center text-sm text-muted-foreground">
        {locale === 'en' ? 'No photos yet.' : 'Még nem érkezett kép.'}
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((photo) => (
        <Tile
          key={photo.id}
          photo={photo}
          slug={slug}
          onToggle={toggle}
          locale={locale}
        />
      ))}
    </ul>
  )
}
