'use client'

import { AlbumDownload } from '@/components/host/album-download'
import type { ExportResponse } from '@/lib/album-export'
import type { ModerationTile } from '@/lib/photos'
import { Eye, EyeOff } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useOptimistic, useState, useTransition } from 'react'
import { setPhotoHidden } from '@/app/(product)/host/events/[slug]/actions'
import { T, still } from '@/lib/motion'
import { track } from '@/lib/telemetry'

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
  eventId,
  onToggle,
  locale,
}: {
  photo: ModerationTile
  slug: string
  eventId: string
  onToggle: (photoId: string) => void
  locale: 'en' | 'hu'
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const [developed, setDeveloped] = useState(false)
  const reduceMotion = useReducedMotion()
  const hidden = photo.hidden_at !== null

  return (
    <li className="relative">
      {/* Hiding and restoring is a cross-fade on `settle` — no scale, no
          bounce, and the tile never leaves the grid. Hiding is a reversible
          state, not an event to celebrate.

          Grayscale as well as dimmed: opacity alone on a bright wedding photo
          still reads as "in the album, slightly faded". Draining the colour is
          what makes a hidden frame legible as withheld at a glance down a grid
          of forty. */}
      <motion.div
        className="relative aspect-square overflow-hidden rounded-sm"
        initial={false}
        animate={{
          opacity: hidden ? 0.4 : 1,
          filter: hidden ? 'grayscale(1)' : 'grayscale(0)',
        }}
        transition={reduceMotion ? still : T.settle}
      >
        {/* A frame that has just arrived develops in, the same way it did on
            the phone that took it. `onError` resolves it too, so a tile that
            cannot load ends up an honest empty square rather than a smudge. */}
        <motion.span
          className="absolute inset-0 block"
          initial={{ filter: 'grayscale(1) blur(8px)', scale: 1.04 }}
          animate={
            developed
              ? { filter: 'grayscale(0) blur(0px)', scale: 1 }
              : { filter: 'grayscale(1) blur(8px)', scale: 1.04 }
          }
          transition={reduceMotion ? still : T.develop}
        >
          <Image
            // Built server-side from the storage path, so this component
            // never learns the bucket's layout.
            src={photo.thumbUrl}
            alt={
              photo.uploaderName
                ? en
                  ? `Photo by ${photo.uploaderName}`
                  : `${photo.uploaderName} fotója`
                : en
                  ? 'Photo'
                  : 'Fotó'
            }
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            unoptimized
            onLoad={() => setDeveloped(true)}
            onError={() => setDeveloped(true)}
            className="object-cover"
          />
        </motion.span>
      </motion.div>

      {/* A caption bar rather than a floating circle. The name was only in the
          alt text before, so a host moderating had no way to see whose frame
          they were about to hide without opening it; and a lone round button
          over the corner of a photo covers the part of it most likely to
          matter. The gradient carries both. */}
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
              // After the round trip, not beside the optimistic flip: the
              // whole point of the number is how much of an album a host takes
              // out, and a tap that failed took nothing out. The photo id
              // stays here — it identifies one guest's frame.
              track('photo_moderated', { event_id: eventId, hidden: !hidden })
            } catch {
              setError(true)
            }
          })
        }
        aria-pressed={hidden}
        aria-label={
          hidden
            ? en
              ? photo.uploaderName
                ? `Restore photo by ${photo.uploaderName}`
                : 'Restore photo'
              : photo.uploaderName
                ? `${photo.uploaderName} fotójának visszaállítása`
                : 'Fotó visszaállítása'
            : en
              ? photo.uploaderName
                ? `Hide photo by ${photo.uploaderName}`
                : 'Hide photo'
              : photo.uploaderName
                ? `${photo.uploaderName} fotójának elrejtése`
                : 'Fotó elrejtése'
        }
        // No spinner. The icon has already flipped, so a spinner on top of it
        // would be reporting on work the host has been told is done. The dimmed
        // state is enough to say the tap landed and is still settling.
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-sm bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 text-left transition-opacity disabled:opacity-70"
      >
        <span className="truncate font-mono text-[9px] tracking-[0.06em] text-white/85">
          {hidden
            ? en
              ? 'HIDDEN'
              : 'REJTVE'
            : (photo.uploaderName?.toUpperCase() ?? '')}
        </span>
        {hidden ? (
          <Eye className="size-3.5 shrink-0 text-white/90" aria-hidden="true" />
        ) : (
          <EyeOff
            className="size-3.5 shrink-0 text-white/75"
            aria-hidden="true"
          />
        )}
      </button>

      {error ? (
        <p className="mt-1 text-xs text-destructive">
          {en ? 'Failed' : 'Nem sikerült'}
        </p>
      ) : null}
    </li>
  )
}

export function ModerationGrid({
  photos,
  slug,
  eventId,
  locale,
  title,
  exportEndpoint,
  exportInitial = null,
  exportNote = null,
}: {
  photos: ModerationTile[]
  slug: string
  /** Telemetry only. */
  eventId: string
  locale: 'en' | 'hu'
  /** The section heading, rendered beside the toolbar it belongs with. */
  title: string
  /** The album export endpoint, or null when there is nothing to export. */
  exportEndpoint: string | null
  /** What the server already knows about a prepared archive, if anything. */
  exportInitial?: ExportResponse | null
  /** One sentence under the toolbar saying what the button will do. */
  exportNote?: string | null
}) {
  const en = locale === 'en'
  // Held for the whole grid rather than per tile. It reads as one piece of
  // state because it is one: a tile flipping is a change to the list, and the
  // moment anything else is derived from that list — a count, a filter, a
  // removed row — per-tile state would leave it a round trip behind.
  const [items, toggle] = useOptimistic(photos, (state, photoId: string) =>
    state.map((p) =>
      p.id === photoId
        ? { ...p, hidden_at: p.hidden_at ? null : OPTIMISTIC_HIDDEN }
        : p,
    ),
  )
  return (
    <>
      {/* No count in here. The page's own figure row above already says how
          many photos the event has, and two counts of the same thing on one
          screen is one of them being wrong at some point. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h2 className="font-display text-[26px] leading-none">{title}</h2>

        {exportEndpoint ? (
          <AlbumDownload
            endpoint={exportEndpoint}
            eventId={eventId}
            photoCount={items.length}
            locale={locale}
            initial={exportInitial}
          />
        ) : null}
      </div>

      {exportNote ? (
        <p className="mt-2 text-xs text-muted-foreground">{exportNote}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4.5 rounded-2xl border border-border px-5 py-6 text-center text-sm text-muted-foreground">
          {en ? 'No photos yet.' : 'Még nem érkezett kép.'}
        </p>
      ) : (
        <ul className="mt-4.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((photo) => (
            <Tile
              key={photo.id}
              photo={photo}
              slug={slug}
              eventId={eventId}
              onToggle={toggle}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </>
  )
}
