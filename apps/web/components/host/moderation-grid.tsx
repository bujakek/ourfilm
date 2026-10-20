'use client'

import { AlbumDownload } from '@/components/host/album-download'
import { QrSheetButton } from '@/components/host/qr-sheet'
import { HOST_PRIMARY } from '@/components/host/ui/classes'
import { StateNotice } from '@/components/host/ui/state-notice'
import { useHostToast } from '@/components/host/ui/toast'
import { Lightbox } from '@/components/event/lightbox'
import type { ExportResponse } from '@/lib/album-export'
import type { ModerationTile } from '@/lib/photos'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useOptimistic, useRef, useState, useTransition } from 'react'
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

/** Absolute rather than a toggle, so an undo that lands after the server's
 *  answer has already flipped the row still means "show it". */
type Action =
  | { type: 'hidden'; id: string; hidden: boolean }
  | { type: 'remove'; id: string }

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
  qr = null,
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
  /** What the empty album's "share the QR code" needs (7b). Null once the
   *  camera has closed, when asking for a share would send nobody anywhere. */
  qr?: { name: string; url: string; shots: number } | null
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
                hidden_at: action.hidden
                  ? (photo.hidden_at ?? OPTIMISTIC_HIDDEN)
                  : null,
              }
            : photo,
        ),
  )
  const [open, setOpen] = useState<number | null>(null)
  const reduceMotion = useReducedMotion()
  const toast = useHostToast()
  const [, startTransition] = useTransition()

  // Here rather than in the viewer, because its undo outlives the viewer: the
  // toast stays for four seconds after the host may have closed the photo.
  function setHidden(id: string, hidden: boolean) {
    // Shown with the flip, on the same tap; a failure replaces it.
    toast.show(
      hidden
        ? en
          ? 'Hidden from guests'
          : 'Elrejtve a vendégek elől'
        : en
          ? 'Visible to guests again'
          : 'Újra látható a vendégeknek',
      hidden
        ? {
            label: en ? 'Undo' : 'Visszavonás',
            onAction: () => setHidden(id, false),
          }
        : undefined,
    )
    startTransition(async () => {
      // Before the await, so the frame flips on the same tap.
      apply({ type: 'hidden', id, hidden })
      try {
        await setPhotoHidden(slug, id, hidden)
        // After the round trip, not beside the flip: the whole point of the
        // number is how much of an album a host takes out, and a tap that
        // failed took nothing out.
        track('photo_moderated', { event_id: eventId, hidden })
      } catch {
        // The optimistic flip rolls back with the transition; this says so.
        toast.show(en ? 'That did not save.' : 'Nem sikerült menteni.', {
          label: en ? 'Retry' : 'Újra',
          onAction: () => setHidden(id, hidden),
        })
      }
    })
  }

  return (
    <>
      {/* The count beside the heading is `items.length`, the optimistic
          list, so it moves on the same frame as a hide or delete. */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h2 className="flex items-baseline gap-2.5 font-landing-display text-[22px] leading-none text-white">
          {title}
          <span className="host-figure text-[26px]">{items.length}</span>
        </h2>

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
        <p className="mt-2 text-xs text-white/65">{exportNote}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-4.5">
          <StateNotice
            tone="neutral"
            title={en ? 'No photos yet' : 'Még nem érkezett kép'}
            body={
              qr
                ? en
                  ? 'As soon as a guest takes a photo, it appears here. Share the QR code to get it started.'
                  : 'Amint egy vendég fotózik, a képe itt jelenik meg. Oszd meg a QR-kódot, hogy elinduljon.'
                : en
                  ? 'Photos guests take appear here.'
                  : 'A vendégek képei itt jelennek meg.'
            }
            actions={
              qr ? (
                <QrSheetButton
                  name={qr.name}
                  url={qr.url}
                  eventId={eventId}
                  shots={qr.shots}
                  locale={locale}
                  label={en ? 'Share the QR code' : 'QR-kód megosztása'}
                />
              ) : null
            }
          />
        </div>
      ) : (
        <ul className="mt-4.5 grid grid-cols-3 gap-2">
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
            onSetHidden={setHidden}
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
        className="group relative block aspect-square w-full overflow-hidden rounded-[12px]"
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

        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-b-[12px] bg-gradient-to-t from-black/80 to-transparent px-2 pt-6 pb-1.5 text-left">
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
 * arrow keys, the exit — and this fills its host slots. That is the whole
 * difference between the two sides, and it is why there is not a second viewer.
 *
 * Order in the bar is deliberate: hide, then save, then delete. The
 * irreversible action does not sit next to the reversible one, so a thumb
 * aiming for `Elrejtés` and missing does not destroy a guest's photo.
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
  onSetHidden,
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
  onSetHidden: (id: string, hidden: boolean) => void
  apply: (action: Action) => void
}) {
  const en = locale === 'en'
  const toast = useHostToast()
  // No `isPending`. Every action here is optimistic — the frame flips, the row
  // leaves, the viewer moves on — and a control greyed out behind that is
  // reporting on work the host has already been shown the result of. Worse
  // after a delete, where `pending` belongs to a photo that is no longer on
  // screen and would disable the buttons for the one that is.
  const [, startTransition] = useTransition()
  // The id, not a flag: a confirmation belongs to one photo, and swiping on
  // while it is open must not carry it over to the next one.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cancel unmounts the button that had focus; this hands it back to Delete.
  const refocusDelete = useRef(false)
  const photo = photos[index]
  const hidden = photo.hidden_at !== null
  const confirming = confirmingId === photo.id

  // The last photo stays. `deletePhoto` refuses it too — this is what stops the
  // host reaching a refusal they cannot act on rather than the check itself.
  const deleteBlocked = photos.length <= 1

  const time = photo.takenAt
    ? eventStamp(photo.takenAt, timeZone).slice(11, 16)
    : null
  const name = photo.uploaderName ?? (en ? 'Photo' : 'Fotó')

  function confirmDelete() {
    // **Outside the transition, on purpose.** These are the answer to the
    // tap, and a transition update is held at low priority until the whole
    // async callback settles — so the confirmation stayed on screen, over the
    // *next* photo, for as long as the request took. The host had already
    // decided; the only thing still owed is the round trip.
    setError(null)
    setConfirmingId(null)
    // Removing shifts the list under the index, so staying put lands on the
    // next photo — which is what a host clearing a run of bad frames wants.
    // Only the end of the album has nowhere forward to go, and stepping back
    // has to happen *before* the row leaves: the grid renders the viewer only
    // while `items[open]` exists, so removing the last one first would unmount
    // it mid-delete and it would blink back at the previous photo.
    if (index >= photos.length - 1 && index > 0) onNavigate(index - 1)

    startTransition(async () => {
      // Inside, because this is the one piece React owns: an optimistic value
      // only holds while its transition is pending, and rolls back by itself
      // if the action throws.
      apply({ type: 'remove', id: photo.id })
      try {
        await deletePhoto(slug, photo.id)
        // No undo, by the owner's decision: the objects are gone from Storage
        // and the CDN by now, and an undo would need a soft-delete window the
        // server does not have.
        toast.show(en ? 'Photo deleted' : 'Kép törölve')
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

  const barButton =
    'flex min-h-13 min-w-0 flex-1 items-center justify-center rounded-[20px] px-2 py-2 text-center text-[15px] leading-[1.2] font-medium hyphens-auto transition-colors'

  return (
    <Lightbox
      photos={photos}
      eventId={eventId}
      index={index}
      locale={locale}
      onClose={onClose}
      onNavigate={onNavigate}
      dimmed={hidden}
      heading={
        <>
          <p className="truncate text-[15px] leading-[1.3] font-medium text-white">
            {name}
          </p>
          {time ? (
            <p className="text-[13px] leading-[1.3] text-white/75">{time}</p>
          ) : null}
        </>
      }
      overlay={
        hidden ? (
          <p className="rounded-full bg-black/80 px-3.5 py-2 text-[13px] leading-[1.3] font-medium text-host-warn">
            {en ? 'Hidden from guests' : 'Elrejtve a vendégek elől'}
          </p>
        ) : null
      }
      actions={
        confirming ? (
          // Inline, in place of the bar, rather than a second dialog on top
          // of the first — so the photo the host is agreeing to destroy stays
          // in front of them while they decide.
          <div
            role="group"
            aria-labelledby="delete-photo-title"
            aria-describedby="delete-photo-body"
            className="rounded-[28px] bg-host-sheet p-5 shadow-host-sheet"
          >
            <p
              id="delete-photo-title"
              className="text-[16px] leading-[1.5] font-medium text-white"
            >
              {en ? 'Delete this photo?' : 'Törlöd ezt a képet?'}
            </p>
            <p
              id="delete-photo-body"
              className="mt-1 text-[14px] leading-[1.6] text-pretty break-words text-white/70"
            >
              {en
                ? photo.uploaderName
                  ? `${photo.uploaderName}’s photo will be permanently deleted from the gallery. This cannot be undone.`
                  : 'The photo will be permanently deleted from the gallery. This cannot be undone.'
                : photo.uploaderName
                  ? `${photo.uploaderName} képe véglegesen törlődik a galériából. Nem vonható vissza.`
                  : 'A kép véglegesen törlődik a galériából. Nem vonható vissza.'}
            </p>
            <div className="mt-4 flex gap-2">
              {/* Cancel is the white one and has focus, so Enter is never
                  the delete. */}
              <button
                type="button"
                autoFocus
                onClick={() => {
                  refocusDelete.current = true
                  setConfirmingId(null)
                }}
                className={`${HOST_PRIMARY} min-w-0 flex-1`}
              >
                {en ? 'Cancel' : 'Mégsem'}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex h-14 min-w-0 flex-1 items-center justify-center rounded-[16px] bg-host-danger-fill px-4 text-[16px] font-medium text-host-danger transition-opacity hover:opacity-85"
              >
                {en ? 'Delete' : 'Törlés'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {deleteBlocked ? (
              <p
                id="delete-blocked"
                className="mx-2 mb-2.5 text-[14px] leading-[1.5] text-pretty text-white/75"
              >
                {en
                  ? 'This is the last photo in the event, so it cannot be deleted. You can hide it instead, and guests will no longer see it.'
                  : 'Ez az esemény utolsó képe, ezért nem törölheted. Elrejtheted, így a vendégek nem látják.'}
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mx-2 mb-2.5 text-[14px] leading-[1.5] text-pretty text-host-danger"
              >
                {error}
              </p>
            ) : null}

            <div className="flex gap-2 rounded-[28px] bg-host-sheet p-2 shadow-host-sheet">
              <button
                type="button"
                onClick={() => onSetHidden(photo.id, !hidden)}
                className={`${barButton} bg-white/8 text-white hover:bg-white/12`}
              >
                {hidden
                  ? en
                    ? 'Show'
                    : 'Megjelenítés'
                  : en
                    ? 'Hide'
                    : 'Elrejtés'}
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
                className={`${barButton} bg-white/8 text-white hover:bg-white/12`}
              >
                {en ? 'Save' : 'Mentés'}
              </button>

              <button
                type="button"
                ref={(button) => {
                  if (button && refocusDelete.current) {
                    refocusDelete.current = false
                    button.focus()
                  }
                }}
                onClick={() => {
                  setError(null)
                  setConfirmingId(photo.id)
                }}
                disabled={deleteBlocked}
                aria-describedby={deleteBlocked ? 'delete-blocked' : undefined}
                className={`${barButton} bg-host-danger-fill text-host-danger hover:opacity-85 disabled:bg-white/4 disabled:text-white/45 disabled:hover:opacity-100`}
              >
                {en ? 'Delete' : 'Törlés'}
              </button>
            </div>
          </div>
        )
      }
    />
  )
}
