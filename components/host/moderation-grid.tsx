'use client'

import type { ModerationTile } from '@/lib/photos'
import { cn } from '@/lib/utils'
import { Download, Eye, EyeOff } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useOptimistic, useState, useTransition } from 'react'
import { setPhotoHidden } from '@/app/(product)/host/events/[slug]/actions'
import { T, still } from '@/lib/motion'

/**
 * Stands in for a real `hidden_at` until the server sends one back.
 *
 * Nothing here reads the value — the tile and the counter both ask only
 * whether it is null — and a constant keeps the `useOptimistic` reducer pure.
 * `new Date()` there would be a fresh value on every render of a function
 * React may call more than once.
 */
const OPTIMISTIC_HIDDEN = 'optimistic'

type Filter = 'all' | 'hidden'

function Tile({
  photo,
  slug,
  onToggle,
  locale,
  filteredOut,
}: {
  photo: ModerationTile
  slug: string
  onToggle: (photoId: string) => void
  locale: 'en' | 'hu'
  /** Hidden by the filter, not by the host. Still mounted — see the grid. */
  filteredOut: boolean
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  const [developed, setDeveloped] = useState(false)
  const reduceMotion = useReducedMotion()
  const hidden = photo.hidden_at !== null

  return (
    <li className={cn('relative', filteredOut && 'hidden')}>
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
            // Signed server-side: the bucket is private, so the URL is a
            // short-lived capability rather than an address this component
            // could have built for itself.
            src={photo.thumbUrl}
            alt={
              en
                ? `Photo by ${photo.uploaderName}`
                : `${photo.uploaderName} fotója`
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
            } catch {
              setError(true)
            }
          })
        }
        aria-pressed={hidden}
        aria-label={
          hidden
            ? en
              ? `Restore photo by ${photo.uploaderName}`
              : `${photo.uploaderName} fotójának visszaállítása`
            : en
              ? `Hide photo by ${photo.uploaderName}`
              : `${photo.uploaderName} fotójának elrejtése`
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
            : photo.uploaderName.toUpperCase()}
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
  locale,
  title,
  albumHref,
}: {
  photos: ModerationTile[]
  slug: string
  locale: 'en' | 'hu'
  /** The section heading, rendered beside the toolbar it belongs with. */
  title: string
  /** The ZIP export, or null when there is nothing to export. */
  albumHref: string | null
}) {
  const en = locale === 'en'
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
  const [filter, setFilter] = useState<Filter>('all')

  const reduceMotion = useReducedMotion()
  const hiddenCount = items.filter((p) => p.hidden_at !== null).length

  return (
    <>
      {/* The counts live in here rather than on the page, because they are read
          off the same optimistic state the tiles are — a server-rendered count
          beside an optimistic grid is a count that lags every tap. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h2 className="font-display text-[26px] leading-none">{title}</h2>

        <div className="flex flex-wrap items-center gap-2.5">
          {items.length > 0 ? (
            <p className="font-mono text-[10px] tracking-[0.1em] text-foreground/45">
              {items.length} {en ? 'PHOTOS' : 'KÉP'}
              {hiddenCount > 0
                ? ` · ${hiddenCount} ${en ? 'HIDDEN' : 'REJTVE'}`
                : ''}
            </p>
          ) : null}

          {/* Moderation stops being a scavenger hunt: with forty photos and one
              hidden, finding the hidden one meant scrolling for a dimmed tile. */}
          {hiddenCount > 0 ? (
            <div
              role="group"
              aria-label={en ? 'Filter photos' : 'Képek szűrése'}
              className="flex overflow-hidden rounded-full border border-white/14"
            >
              {/* One indicator sliding between two cells, never two elements
                  each animating their own background. Same pattern as the
                  roll-length and reveal selectors, and the rule from here on. */}
              {(['all', 'hidden'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`relative px-3.5 py-1.5 text-[11px] font-medium transition-colors ${
                    filter === value
                      ? 'text-foreground'
                      : 'text-foreground/60 hover:text-foreground'
                  }`}
                >
                  {filter === value ? (
                    <motion.span
                      layoutId="moderation-filter"
                      aria-hidden="true"
                      className="absolute inset-0 bg-white/10"
                      transition={reduceMotion ? still : T.snap}
                    />
                  ) : null}
                  <span className="relative">
                    {value === 'all'
                      ? en
                        ? 'All'
                        : 'Mind'
                      : en
                        ? 'Hidden'
                        : 'Rejtett'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {albumHref ? (
            <a
              href={albumHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/14 px-3.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-white/30 hover:text-foreground"
            >
              <Download className="size-3.5" aria-hidden="true" />
              {en ? 'Album' : 'Album'}
            </a>
          ) : null}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4.5 rounded-2xl border border-border px-5 py-6 text-center text-sm text-muted-foreground">
          {en ? 'No photos yet.' : 'Még nem érkezett kép.'}
        </p>
      ) : (
        // Filtering hides tiles rather than unmounting them, so switching to
        // Rejtett does not make a two-item list develop itself in again.
        // Entrance animations belong to first paint; replaying them on a
        // filter makes a filter feel like a page load.
        <ul className="mt-4.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map((photo) => (
            <Tile
              key={photo.id}
              photo={photo}
              slug={slug}
              onToggle={toggle}
              locale={locale}
              filteredOut={filter === 'hidden' && photo.hidden_at === null}
            />
          ))}
        </ul>
      )}
    </>
  )
}
