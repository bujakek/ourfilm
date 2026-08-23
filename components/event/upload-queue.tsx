'use client'

import { CreateOwnAlbum } from '@/components/event/create-own-album'
import { markUploadedTo, readGuestName } from '@/lib/guest-name'
import { prepareForUpload, type PreparedPhoto } from '@/lib/image'
import { rememberUpload } from '@/lib/recent-uploads'
import { uploadPhoto, UploadRefusedError } from '@/lib/upload-photo'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Camera,
  Check,
  ImagePlus,
  Images,
  Loader2,
  RotateCw,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Keep `.heic`/`.heif` listed. Excluding them makes iOS hand over a
 *  transcoded JPEG sometimes, but on other paths it just makes the file
 *  unselectable — a guest tapping a photo that refuses to be picked has no
 *  idea why. We convert them ourselves regardless. */
const ACCEPT = 'image/jpeg,image/png,image/webp,.heic,.heif'

/**
 * How many photos may be on the wire at once.
 *
 * Three, because the bottleneck at a venue is per-request latency rather than
 * bandwidth: a single 2MB PUT spends much of its life in handshake and ack,
 * and a guest posting twenty photos used to pay that serially, twenty times.
 * Decoding stays strictly one at a time regardless — that is the step holding
 * a full-size bitmap, and two at once is what runs mobile Safari out of
 * memory. This only ever holds prepared blobs, a couple of megabytes each.
 */
const UPLOAD_CONCURRENCY = 3

type Status = 'queued' | 'preparing' | 'uploading' | 'done' | 'error'

type Item = {
  key: string
  file: File
  previewUrl: string
  status: Status
  error?: string
  /** Retrying will fail the same way — the album refused it, not the network. */
  fatal?: boolean
  /** The preview URL now belongs to `recent-uploads`, which shows it in the
   *  gallery after this component is gone. Unmount must not revoke it. */
  handedOver?: boolean
}

const STATUS_LABEL: Record<Status, string> = {
  queued: 'várakozik',
  preparing: 'feltöltés…',
  uploading: 'feltöltés…',
  done: 'kész',
  error: 'nem sikerült',
}

const isBusy = (s: Status) =>
  s === 'queued' || s === 'preparing' || s === 'uploading'

export function UploadQueue({
  eventId,
  slug,
  galleryPrivate,
  remaining: initialRemaining,
}: {
  eventId: string
  slug: string
  galleryPrivate: boolean
  /** How many photos the album still accepts; null when it has no cap. */
  remaining: number | null
}) {
  const [items, setItems] = useState<Item[]>([])
  // Counted down here rather than re-read from the server after every photo.
  // The number only ever shrinks while this component is mounted, and a round
  // trip per upload on venue wifi would cost more than the count is worth.
  // The database is still the enforcement — see UploadRefusedError below.
  const [remaining, setRemaining] = useState(initialRemaining)
  const [droppedForSpace, setDroppedForSpace] = useState(0)
  const itemsRef = useRef<Item[]>([])
  const runningRef = useRef(false)
  // Revoke previews on unmount. Object URLs live until the document dies, so
  // a guest who uploads forty photos and stays on the page would otherwise
  // pin forty full-size images in memory on a phone.
  //
  // Except the ones handed to `recent-uploads`: those are about to be rendered
  // by the gallery this guest is on their way to, and revoking here would
  // leave it drawing broken tiles. That store owns them and caps its own size.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => {
        if (!i.handedOver) URL.revokeObjectURL(i.previewUrl)
      })
    },
    [],
  )

  const busy = items.some((i) => isBusy(i.status))

  // Uploads are not resumable — navigating away mid-queue loses the rest.
  useEffect(() => {
    if (!busy) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [busy])

  // Ref and state move together, synchronously. runQueue scans the ref to pick
  // the next file and cannot wait for a React commit: with a prepare running
  // ahead of an upload there are two scans inside one render, and a stale ref
  // would hand both of them the same photo.
  const patch = useCallback((key: string, next: Partial<Item>) => {
    itemsRef.current = itemsRef.current.map((i) =>
      i.key === key ? { ...i, ...next } : i,
    )
    setItems(itemsRef.current)
  }, [])

  const runQueue = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true

    const reason = (e: unknown) =>
      e instanceof Error ? e.message : 'Ismeretlen hiba'

    // Claim the next queued file and start decoding it. Marking it `preparing`
    // is what stops the following scan claiming the same one.
    const startNext = () => {
      const item = itemsRef.current.find((i) => i.status === 'queued')
      if (!item) return null

      patch(item.key, { status: 'preparing', error: undefined })
      const work = prepareForUpload(item.file)
      // Awaited below, so a rejection would otherwise spend that whole window
      // looking unhandled to the browser. This observes it without consuming
      // it — the await still sees the rejection.
      work.catch(() => {})
      return { item, work }
    }

    // One prepared photo's trip to Storage. Deliberately never rejects: a
    // failure is queue state, and the pool below races these, so a rejection
    // would surface as an unhandled one the moment it lost the race.
    const send = async (item: Item, prepared: PreparedPhoto) => {
      // The join gate guarantees this is set. `|| null` covers the guest who
      // cleared site data mid-session rather than trusting it.
      const uploaderName = readGuestName() || null

      try {
        const photoId = await uploadPhoto({ eventId, prepared, uploaderName })
        patch(item.key, { status: 'done', handedOver: true })
        // Committed, so the gallery can show it on sight rather than after a
        // round trip. Only reached on success — see `lib/recent-uploads.ts`.
        rememberUpload(slug, {
          id: photoId,
          previewUrl: item.previewUrl,
          uploaderName,
        })
        markUploadedTo(eventId)
        setRemaining((left) => (left === null ? null : Math.max(left - 1, 0)))
      } catch (e) {
        // A refusal is final, so it must not leave an "Újrapróbálom" button promising
        // otherwise. It also means the local count is stale — two guests can
        // both spend the last slot — so trust the database and zero it.
        if (e instanceof UploadRefusedError) setRemaining(0)
        patch(item.key, {
          status: 'error',
          error: reason(e),
          fatal: e instanceof UploadRefusedError,
        })
      }
    }

    const inFlight = new Set<Promise<void>>()

    try {
      for (;;) {
        // Block only when the pool is full. Uploads dominate the wall clock on
        // venue wifi and a single HTTPS PUT never saturates the uplink — the
        // limit is per-request latency, not bandwidth — so sending strictly
        // one at a time left the radio idle through every handshake and ack.
        if (inFlight.size >= UPLOAD_CONCURRENCY) await Promise.race(inFlight)

        // Scan here rather than trusting a lookahead: files the guest added
        // while earlier photos were in flight are only visible now.
        const next = startNext()
        if (!next) break

        let prepared: PreparedPhoto
        try {
          prepared = await next.work
        } catch (e) {
          patch(next.item.key, { status: 'error', error: reason(e) })
          continue
        }

        patch(next.item.key, { status: 'uploading' })

        // Not awaited: this is what lets the next decode start while this photo
        // is on the wire. Awaiting the decode above is equally deliberate —
        // two at once is what runs mobile Safari out of memory, and it is the
        // decode that holds the full-size bitmap, not the send.
        const sending = send(next.item, prepared).finally(() => {
          inFlight.delete(sending)
        })
        inFlight.add(sending)
      }

      // `send` swallows its own failures, so this settles rather than rejects.
      await Promise.all(inFlight)
    } finally {
      // Nothing awaits between the scan that ends the loop and this line, so a
      // file added by the guest cannot slip in behind a still-true flag.
      runningRef.current = false
    }
  }, [eventId, slug, patch])

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return

    // Queue only what can actually land. Letting the rest through would decode
    // and upload each one just to watch the database refuse it — slow, and it
    // fills the list with failures that look like the guest's fault.
    const queued = itemsRef.current.filter((i) => isBusy(i.status)).length
    const room = remaining === null ? files.length : remaining - queued
    const accepted = Array.from(files).slice(0, Math.max(room, 0))
    setDroppedForSpace(files.length - accepted.length)
    if (accepted.length === 0) return

    const added: Item[] = accepted.map((file) => ({
      key: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued' as const,
    }))
    itemsRef.current = [...itemsRef.current, ...added]
    setItems(itemsRef.current)
    void runQueue()
  }

  const retry = (key: string) => {
    patch(key, { status: 'queued', error: undefined })
    void runQueue()
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  // Only the ones "Újra" can actually help. A photo the album refused would
  // fail identically on a retry, and counting it here would send a guest
  // tapping a button that cannot work.
  const failedCount = items.filter(
    (i) => i.status === 'error' && !i.fatal,
  ).length
  const allSettled = items.length > 0 && !busy
  const full = remaining === 0

  return (
    <div className="flex flex-col gap-6">
      {allSettled && doneCount > 0 ? (
        <div className="glass-strong flex flex-col items-center gap-3 rounded-3xl px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent/20">
            <Check className="size-7 text-accent" strokeWidth={2.2} />
          </span>
          <p className="text-xl font-semibold tracking-tight">
            {doneCount === 1
              ? 'Megvan! A képed bekerült a közös albumba.'
              : `Megvan! ${doneCount} képed bekerült a közös albumba.`}
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">
            {galleryPrivate
              ? 'A közös albumot a házigazda egyelőre elrejtette — a képeid megvannak, és akkor lesznek láthatók, amikor újra megnyitja. Tölthetsz fel még képeket.'
              : 'Köszönjük, hogy megosztottad. Tölthetsz fel még képeket, vagy megnézheted a többiek pillanatait.'}
          </p>
          {!galleryPrivate ? (
            <Link
              href={`/e/${slug}/gallery`}
              className="glass glass-hover mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold"
            >
              <Images className="size-4" strokeWidth={1.8} />
              Közös album megnyitása
            </Link>
          ) : null}

          {/* `alwaysShow`: the upload that qualifies them just happened, so
              there is no need to re-read the flag we only just wrote. */}
          <div className="w-full text-left">
            <CreateOwnAlbum eventId={eventId} alwaysShow />
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="glass flex items-center gap-3 rounded-2xl p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element --
                  a blob: URL has no intrinsic remote source for next/image to
                  optimise, and these are transient previews. */}
              <img
                src={item.previewUrl}
                alt=""
                className="size-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-xs',
                    item.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.status === 'preparing' ||
                  item.status === 'uploading' ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                  {item.status === 'done' ? (
                    <Check className="size-3 text-accent" />
                  ) : null}
                  {item.status === 'error' ? (
                    <AlertCircle className="size-3" />
                  ) : null}
                  {STATUS_LABEL[item.status]}
                </p>
              </div>
              {item.status === 'error' && !item.fatal ? (
                <button
                  type="button"
                  onClick={() => retry(item.key)}
                  className="glass glass-hover flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
                >
                  <RotateCw className="size-3.5" />
                  Újrapróbálom
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* No file-type or file-size copy here on purpose: the pipeline enforces
          neither, so naming a limit would invent one. What actually fails at a
          venue is the network, which is what this says. */}
      {failedCount > 0 && !busy ? (
        <div className="text-center">
          <p className="text-sm font-medium">A feltöltés nem sikerült</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">
            Ellenőrizd az internetkapcsolatot, majd próbáld meg újra.
          </p>
        </div>
      ) : null}

      {full ? (
        // The one thing a guest can do about this is tell the host, so that is
        // what the copy says. It deliberately does not mention payment: the
        // guest is not the customer, and "they did not pay" is a miserable
        // thing to read at somebody's wedding.
        <div className="glass rounded-2xl px-6 py-5 text-center">
          <p className="font-semibold">Ez a közös album most megtelt</p>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
            Egyelőre nem fogad több képet. Szólj a házigazdának — ha feloldja,
            folytathatod ott, ahol abbahagytad.
          </p>
        </div>
      ) : null}

      {droppedForSpace > 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          {droppedForSpace} képet nem tudtunk sorba állítani — annyi már nem fér
          bele ebbe az albumba.
        </p>
      ) : null}

      {/* Two entry points, not one input with `capture` bolted on. Adding
          `capture` to the picker would *replace* gallery access rather than
          add to it, and most of what a guest uploads is already in their
          camera roll. Camera leads because the other half of the job is the
          shot they are about to take. */}
      <div className={cn('flex gap-2', full && 'hidden')}>
        <label
          className={cn(
            'btn-shine inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-transform',
            busy ? 'pointer-events-none opacity-60' : 'hover:scale-[1.02]',
          )}
        >
          <Camera className="size-5" strokeWidth={1.8} />
          Fotózás
          <input
            type="file"
            accept={ACCEPT}
            // No `multiple`: a capture session produces one shot, and the
            // attribute only muddies what the OS offers.
            capture="environment"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        <label
          className={cn(
            'glass glass-hover inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base font-semibold transition-transform',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          <ImagePlus className="size-5" strokeWidth={1.8} />
          Képek
          <input
            type="file"
            accept={ACCEPT}
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files)
              // Reset so picking the same file twice still fires a change.
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {remaining !== null && !full ? (
        <p className="text-center text-xs text-muted-foreground">
          Még {remaining} kép fér ebbe az albumba.
        </p>
      ) : null}

      {busy ? (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Feltöltjük a képeidet — ne zárd be az oldalt. Ez a kapcsolat
          sebességétől függően eltarthat néhány másodpercig.
        </p>
      ) : null}
    </div>
  )
}
