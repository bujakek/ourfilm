'use client'

import { AlbumDownload } from '@/components/host/album-download'
import { Lightbox } from '@/components/event/lightbox'
import type { ExportResponse } from '@/lib/album-export'
import type { ModerationTile } from '@/lib/photos'
import { Download, Eye, EyeOff, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useOptimistic, useState, useTransition } from 'react'
import {
  deletePhoto,
  setPhotoHidden,
} from '@/app/(product)/host/events/[slug]/actions'
import { eventStamp } from '@/lib/format'
import { T, still } from '@/lib/motion'
import { savePhoto } from '@/lib/save-photo'
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

type Action = { type: 'toggle'; id: string } | { type: 'remove'; id: string }

/**
 * The host's album: the guest's contact sheet, with the controls a host needs.
 *
 * It used to be a moderation surface — a two-up grid whose caption bar was a
 * hide button — which meant the host never saw a photo at the size the couple
 * will. Now it is the same three-column sheet the guests get, the same viewer
 * opens on a tap, and the three things only a host can do live inside it.
 *
 * **No control is on the grid itself, deliberately.** Hiding is one tap and
 * reversible; deleting is neither. A host has to be looking at the actual
 * frame at full size before they can withhold or destroy somebody's photo, and
 * the way to guarantee that is to have no other way in.
 */
export function ModerationGrid({
  photos,
  slug,
  eventId,
  locale,
  timeZone,
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
  /** The event's own zone, for the time under a photo. Never the server's. */
  timeZone: string
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
  // One piece of state for the whole grid, because it is one: a tile flipping
  // or leaving is a change to the list, and anything derived from that list
  // has to move on the same frame as the tile it describes.
  const [items, apply] = useOptimistic(photos, (state, action: Action) =>
    action.type === 'remove'
      ? state.filter((photo) => photo.id !== action.id)
      : state.map((photo) =>
          photo.id === action.id
            ? {
                ...photo,
                hidden_at: photo.hidden_at ? null : OPTIMISTIC_HIDDEN,
              }
            : photo,
        ),
  )
  const [open, setOpen] = useState<number | null>(null)
  const reduceMotion = useReducedMotion()

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
        <ul className="mt-4.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {items.map((photo, index) => (
            <Tile
              key={photo.id}
              photo={photo}
              locale={locale}
              reduceMotion={reduceMotion}
              onOpen={() => setOpen(index)}
            />
          ))}
        </ul>
      )}

      <AnimatePresence>
        {open !== null && items[open] ? (
          <HostViewer
            photos={items}
            index={open}
            slug={slug}
            eventId={eventId}
            locale={locale}
            timeZone={timeZone}
            onNavigate={setOpen}
            onClose={() => setOpen(null)}
            apply={apply}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}

/**
 * One frame in the sheet.
 *
 * The whole tile is the tap target and it does exactly one thing: open the
 * photo. The caption is `pointer-events-none` — it was a button, and a caption
 * that is sometimes a control is a caption a host taps by accident while
 * scrolling a hundred photos.
 */
function Tile({
  photo,
  locale,
  reduceMotion,
  onOpen,
}: {
  photo: ModerationTile
  locale: 'en' | 'hu'
  reduceMotion: boolean | null
  onOpen: () => void
}) {
  const en = locale === 'en'
  const [developed, setDeveloped] = useState(false)
  const hidden = photo.hidden_at !== null

  return (
    <li className="relative">
      <motion.button
        type="button"
        onClick={onOpen}
        whileTap={reduceMotion ? undefined : { scale: 0.975 }}
        transition={reduceMotion ? still : T.snap}
        className="group relative block aspect-square w-full overflow-hidden rounded-sm"
      >
        {/* Grayscale as well as dimmed: opacity alone on a bright wedding
            photo still reads as "in the album, slightly faded". Draining the
            colour is what makes a hidden frame legible as withheld at a glance
            down a grid of forty. */}
        <motion.span
          className="absolute inset-0 block"
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
              sizes="(max-width: 640px) 33vw, 200px"
              unoptimized
              onLoad={() => setDeveloped(true)}
              onError={() => setDeveloped(true)}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </motion.span>
        </motion.span>

        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-sm bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 text-left">
          <span className="truncate text-[11.5px] font-semibold text-white/92">
            {photo.uploaderName ?? ''}
          </span>
          {hidden ? (
            <span className="shrink-0 text-[11.5px] font-medium text-white/72">
              {en ? 'Hidden' : 'Rejtve'}
            </span>
          ) : null}
        </span>
      </motion.button>
    </li>
  )
}

/**
 * The photo at full size, with the three things only a host can do to it.
 *
 * The guest's `Lightbox` carries the hard parts — the dialog, the swipe, the
 * arrow keys, the exit — and this adds a footer to it. That is the whole
 * difference between the two sides, and it is why there is not a second viewer.
 *
 * Order in the row is deliberate: hide, then save, then delete. The
 * irreversible action does not sit next to the reversible one, so a thumb
 * aiming for `Elrejtem` and missing does not destroy a guest's photo.
 */
function HostViewer({
  photos,
  index,
  slug,
  eventId,
  locale,
  timeZone,
  onNavigate,
  onClose,
  apply,
}: {
  photos: ModerationTile[]
  index: number
  slug: string
  eventId: string
  locale: 'en' | 'hu'
  timeZone: string
  onNavigate: (next: number) => void
  onClose: () => void
  apply: (action: Action) => void
}) {
  const en = locale === 'en'
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photo = photos[index]
  const hidden = photo.hidden_at !== null

  // The last photo stays. `deletePhoto` refuses it too — this is what stops the
  // host reaching a refusal they cannot act on rather than the check itself.
  const deleteBlocked = photos.length <= 1

  const stamp = photo.takenAt ? eventStamp(photo.takenAt, timeZone) : null
  const caption = [
    photo.uploaderName,
    stamp?.slice(11, 16),
    hidden ? (en ? 'hidden' : 'rejtve') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  function toggleHidden() {
    startTransition(async () => {
      setError(null)
      // Before the await, so the frame flips on the same tap.
      apply({ type: 'toggle', id: photo.id })
      try {
        await setPhotoHidden(slug, photo.id, !hidden)
        // After the round trip, not beside the flip: the whole point of the
        // number is how much of an album a host takes out, and a tap that
        // failed took nothing out.
        track('photo_moderated', { event_id: eventId, hidden: !hidden })
      } catch {
        setError(en ? 'That did not save.' : 'Nem sikerült menteni.')
      }
    })
  }

  function confirmDelete() {
    startTransition(async () => {
      setError(null)
      setConfirming(false)
      // Removing shifts the list under the index, so staying put lands on the
      // next photo — which is what a host clearing a run of bad frames wants.
      // Only the end of the album has nowhere forward to go, and stepping back
      // has to happen *before* the row leaves: the grid renders the viewer only
      // while `items[open]` exists, so removing the last one first would
      // unmount it mid-delete and it would blink back at the previous photo.
      if (index >= photos.length - 1 && index > 0) onNavigate(index - 1)
      apply({ type: 'remove', id: photo.id })
      try {
        await deletePhoto(slug, photo.id)
      } catch (e) {
        // The viewer stays open on the photo that failed. Losing it here would
        // leave the host with no idea which one did not go.
        setError(
          e instanceof Error && e.message
            ? e.message
            : en
              ? 'The photo was not deleted.'
              : 'A kép nem törlődött.',
        )
      }
    })
  }

  return (
    <Lightbox
      photos={photos}
      eventId={eventId}
      index={index}
      locale={locale}
      onClose={onClose}
      onNavigate={onNavigate}
      dimmed={hidden}
      caption={caption}
      actions={
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHidden}
              disabled={pending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/14 text-[12.5px] font-semibold text-white/85 transition-colors hover:border-white/30 disabled:opacity-60"
            >
              {hidden ? (
                <Eye className="size-3.5" aria-hidden="true" />
              ) : (
                <EyeOff className="size-3.5" aria-hidden="true" />
              )}
              {hidden
                ? en
                  ? 'Restore'
                  : 'Visszaállítom'
                : en
                  ? 'Hide'
                  : 'Elrejtem'}
            </button>

            <button
              type="button"
              onClick={() =>
                void savePhoto({
                  url: photo.downloadUrl,
                  filename: photo.downloadName,
                  title: photo.uploaderName ?? photo.downloadName,
                })
              }
              aria-label={en ? 'Save the photo' : 'Kép mentése'}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/14 text-white/85 transition-colors hover:border-white/30"
            >
              <Download className="size-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={deleteBlocked || pending}
              aria-label={en ? 'Delete the photo' : 'Kép törlése'}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-destructive/35 text-destructive transition-colors hover:border-destructive/70 disabled:border-white/10 disabled:text-white/30"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {deleteBlocked ? (
            <p className="mt-2.5 text-[12.5px] leading-[1.5] text-white/55">
              {en
                ? 'This is the last photo in the event, so it cannot be deleted. You can hide it instead, and guests will no longer see it.'
                : 'Ez az utolsó kép az eseményen, ezért nem törölhető. Elrejtheted, így a vendégeknél már nem látszik.'}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-2.5 text-[12.5px] text-destructive">
              {error}
            </p>
          ) : null}

          {/* Inline, under the row, rather than a second dialog on top of the
              first — so the photo the host is agreeing to destroy stays in
              front of them while they decide. */}
          {confirming ? (
            <div className="mt-4 border-t border-destructive/30 pt-3.5">
              <p className="text-[13px] font-semibold">
                {en
                  ? photo.uploaderName
                    ? `Delete ${photo.uploaderName}'s photo?`
                    : 'Delete this photo?'
                  : photo.uploaderName
                    ? `Törlöd ${photo.uploaderName} képét?`
                    : 'Törlöd ezt a képet?'}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.6] text-white/55">
                {en
                  ? 'The photo is permanently removed from storage and will be left out of the film. Hiding can be undone, deleting cannot.'
                  : 'A kép véglegesen törlődik a tárhelyről, és a közös filmből is kimarad. Elrejteni visszavonható, a törlés nem.'}
              </p>
              <div className="mt-3.5 flex gap-2">
                {/* Cancel first and focused, as `DangerZone` has it: Enter is
                    never the delete. */}
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirming(false)}
                  className="min-h-11 flex-1 rounded-full border border-white/14 text-[13px] font-semibold text-white/85"
                >
                  {en ? 'Cancel' : 'Mégsem'}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={pending}
                  className="min-h-11 flex-[1.3] rounded-full border border-destructive/70 text-[13px] font-semibold text-destructive disabled:opacity-60"
                >
                  {en ? 'Yes, delete permanently' : 'Igen, törlöm'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  )
}
