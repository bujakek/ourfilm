'use client'

import type { Frame } from '@/lib/frames'
import type { GalleryTile } from '@/lib/photos'
import { Camera } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'

import {
  commitShotAction,
  releaseShotAction,
  reserveShotAction,
} from '@/app/(product)/e/[slug]/actions'
import {
  captureStatus,
  formatLine,
  offlineQueueNote,
  ownRollNote,
  queueClearedNote,
} from '@/lib/event-copy'
import { compressForStorage, isHeic, prepareStoredShot } from '@/lib/image'
import { track } from '@/lib/telemetry'
import {
  createUploadQueue,
  type UploadIssue,
  type UploadQueue,
} from '@/lib/upload-queue'
import { uploadShotRenders } from '@/lib/upload-shot'
import { uploadStore } from '@/lib/upload-store'
import { type Locale, localeTag } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import { useEntrance } from '@/lib/use-entrance'
import { useOnline } from '@/lib/use-online'
import { LiveDot } from '@/components/ui/live-dot'
import { Odometer } from '@/components/ui/odometer'

import { CreateOwnAlbum } from './create-own-album'
import { type CaptureReceiptState, FilmStrip } from './film-strip'
import { InviteButton } from './invite-button'
import { PhotoGrid } from './photo-grid'

type GalleryState =
  { open: true } | { open: false; heading: string; detail: string | null }

const SLOW_PREPARATION_MS = 5_000

/**
 * What the screen says when something goes wrong.
 *
 * The global line carries only conditions that affect the whole camera. Which
 * of several captures is safe is not one of those — a single line cannot say
 * it about three photos at once, so each frame wears its own mark instead.
 */
type Flash = string | null

/**
 * A shot in flight, from the shutter to the server's 200. There can be
 * several: the shutter does not wait for an upload to finish.
 *
 * `photoId` arrives when the server reserves the frame, and is how the cell
 * hands itself back once `router.refresh()` brings the real one down.
 *
 * It used to hand back by *position* — the cell survived while
 * `frames.length <= index` — which is only correct if shots land in the order
 * they were taken. They do not: a failed upload is deferred and retried while
 * later shots go up. When that happened the filter hid the cell still
 * uploading, kept drawing the one that had already landed on top of its own
 * real frame, and revoked the still-owed photo's preview into the bargain.
 */
type Capture = {
  /** The shot's idempotency key, and its identity for the whole of its life. */
  id: string
  /** Null until `reserve_shot` has granted the frame. */
  photoId: string | null
  previewUrl: string | null
  progress: number
  confirmed: boolean
  /** Whether IndexedDB has acknowledged at least one complete local copy. */
  durable: boolean
  receipt: CaptureReceiptState
}

/**
 * The guest's whole screen, counter first.
 *
 * Reading order is the product's order: what is happening, whose event, how
 * much film is left, what that film looks like, the shutter, the format, and
 * only then everybody else's photos. The frame count used to be the third row
 * of a three-row `<dl>`, weighted exactly like the guest count beside it; it is
 * now by far the largest thing on the screen, because it is the only number a
 * guest makes a decision with.
 *
 * **Nothing here is `position: fixed`, deliberately.** A fixed bottom deck was
 * drawn and rejected: this is a browser page, not an installed app, and on iOS
 * the address bar sits at the bottom and re-expands whenever the page scrolls
 * up, so a deck is either occluded or permanently fighting the same ~100px. The
 * counter and the shutter are simply the top of the document, which nothing can
 * cover. If the shutter ever needs to follow a guest down a long gallery, the
 * answer is `position: sticky` inside the flow — never `fixed` against a
 * viewport iOS redefines mid-scroll.
 *
 * The heights are budgeted for **682px**, not 844: a 390×844 phone spends
 * roughly 54px on the status bar and 108px on Safari's chrome. The shutter and
 * the format line both have to be reachable without scrolling at that height,
 * which is what the 36px event name and the 66px counter are sized against.
 */
export function GuestEventView({
  eventId,
  slug,
  eventName,
  eventUrl,
  captureStartAt,
  captureEndAt,
  initialNow,
  initialCanCapture,
  initialShotsRemaining,
  shotsPerParticipant,
  frames,
  participantCount,
  gallery,
  photos,
  locale,
}: {
  eventId: string
  slug: string
  eventName: string
  eventUrl: string
  captureStartAt: string
  captureEndAt: string
  initialNow: number
  initialCanCapture: boolean
  initialShotsRemaining: number
  shotsPerParticipant: number
  frames: Frame[]
  participantCount: number
  gallery: GalleryState
  photos: GalleryTile[]
  locale: Locale
}) {
  const en = locale === 'en'
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  // Timing for telemetry, keyed by capture id. Refs, not state: none of it is
  // drawn, and a re-render per timestamp would be a re-render per photo.
  const startedAt = useRef(new Map<string, number>())
  const reservedCaptures = useRef(new Set<string>())
  const reportedIssues = useRef(new Set<string>())
  const cameraOpenedAt = useRef<number | null>(null)
  const [remaining, setRemaining] = useState(initialShotsRemaining)
  const [flash, setFlash] = useState<Flash>(null)
  const [now, setNow] = useState(initialNow)
  const [handedOff, setHandedOff] = useState(false)
  const [captures, setCaptures] = useState<Capture[]>([])
  const online = useOnline()
  /**
   * How many shots were taken with no connection and have not been accounted
   * for yet. It is what the receipt line names once the queue drains, and the
   * only reason this screen keeps a success case at all — see
   * `queueClearedNote`. Counted at the shutter rather than watched in an
   * effect: the two moments that change it are a shutter press and a shot
   * being given up on, and both are already handlers.
   */
  const [offlineBacklog, setOfflineBacklog] = useState(0)

  // Once per session, not once per mount. This page is left and re-entered on
  // every single shot — see `lib/use-entrance.ts`.
  const stage = useEntrance({ once: `ourfilm:entered:${slug}`, step: 0.045 })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // The joined half of the funnel's first step. `guest_page_viewed` with
  // `joined: false` is the ticket (`join-form.tsx`); this one says what the
  // guest found behind it. Once per mount, with the props as they arrived.
  useEffect(() => {
    track('guest_page_viewed', {
      event_id: eventId,
      joined: true,
      camera: initialCanCapture ? 'open' : 'closed',
      gallery: gallery.open ? 'open' : 'locked',
      frames: frames.length,
      shots_remaining: initialShotsRemaining,
      photos: photos.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arrival snapshot
  }, [eventId])

  useEffect(() => {
    if (!handedOff) return
    // Tapping the shutter hands the screen to the OS camera, and the only
    // reliable signal that the guest is back is the page becoming visible
    // again. `change` covers the case where a photo was taken; nothing at all
    // fires when the camera is cancelled, which is what this listener is for.
    const back = () => {
      if (document.visibilityState === 'visible') setHandedOff(false)
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('focus', back)
    }
  }, [handedOff])

  // Released when a capture leaves the list, never before. A preview is the
  // only copy of that photo on this device until the real thumbnail comes
  // down, so revoking it early blanks the developing cell mid-upload — which
  // is exactly what a per-capture cleanup effect would have done the moment a
  // second shot replaced the first.
  const shownUrls = useRef(new Set<string>())
  const frameIds = useMemo(
    () => new Set(frames.map((frame) => frame.id)),
    [frames],
  )
  useEffect(() => {
    const live = shownUrls.current
    const shown = new Set(
      captures
        .filter((c) => isDeveloping(c, frameIds))
        .map((c) => c.previewUrl)
        .filter((url): url is string => url !== null),
    )
    for (const url of live) {
      if (!shown.has(url)) {
        URL.revokeObjectURL(url)
        live.delete(url)
      }
    }
    for (const url of shown) live.add(url)
  }, [captures, frameIds])
  useEffect(() => {
    const live = shownUrls.current
    return () => {
      for (const url of live) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])

  const captureEnd = new Date(captureEndAt).getTime()
  const captureIsOpen = initialCanCapture && now <= captureEnd

  // Shots taken but not yet confirmed by `commit_shot`. `remaining` is server
  // truth and stays server truth — it is only ever what a commit returned —
  // but the *gate* has to subtract what is still in flight. Without that, a
  // guest on their last frame could press twice and have the second photo
  // refused after it was taken, and there is no retake in this product.
  const outstanding = captures.filter((c) => isOutstanding(c)).length
  const canTakePhoto = captureIsOpen && remaining - outstanding > 0
  const uploading = outstanding > 0
  /**
   * What the big number says: frames left after the ones already spent.
   *
   * The frame goes at the shutter, not at the upload — `reserve_shot` takes it
   * inside the row lock before a byte moves — and a guest offline for an hour
   * reading "9 left" with three photos already in the bag is being told
   * something false. This is still not a local decrement: `remaining` is
   * whatever `commit_shot` last returned and `outstanding` is what has not
   * come back yet, so the two settle onto the server's number as each shot
   * lands and never cross it. The shutter's own label stays on `remaining`,
   * because "Mentés…" is precisely the state where the roll is spent and the
   * server has not caught up.
   */
  const framesLeft = Math.max(0, remaining - outstanding)

  // Derived rather than cleared in an effect: once `router.refresh()` has
  // brought a capture's own photo down, the strip renders the real frame and
  // that cell stops being shown. `captures` is appended in capture order and
  // never re-sorted, so the survivors stay in order without sorting.
  const developing = captures
    .filter(
      (c): c is Capture & { previewUrl: string } =>
        c.previewUrl !== null && isDeveloping(c, frameIds),
    )
    .map((c) => ({
      previewUrl: c.previewUrl,
      progress: c.progress,
      confirmed: c.confirmed,
      receipt: c.receipt,
      durable: c.durable,
    }))

  /**
   * What takes over the line under the shutter, in order of what a guest
   * needs most: a failure, then an outage, then the receipt for an outage
   * that has ended, and only last a spent roll. `null` when none of those is
   * true, and the line goes back to saying what the product is.
   *
   * The receipt outranks the spent roll because the shutter is already
   * reading "Megtelt a tekercs" and the counter is already at zero, so a
   * third telling of that adds nothing — while "did the photos I took with no
   * signal actually go?" has no other answer anywhere on the screen.
   */
  const statusLine: { text: string; tone: string } | null = flash
    ? { text: flash, tone: 'text-destructive' }
    : !online && outstanding > 0
      ? {
          text: offlineQueueNote(outstanding, canTakePhoto, locale),
          tone: 'text-foreground/62',
        }
      : online && outstanding === 0 && offlineBacklog > 0
        ? {
            text: queueClearedNote(offlineBacklog, locale),
            tone: 'text-accent',
          }
        : remaining <= 0
          ? {
              text: en ? 'Your roll is full.' : 'Megtelt a tekercsed.',
              tone: 'text-muted-foreground',
            }
          : null

  const status = captureStatus(
    {
      now: new Date(now),
      captureStartAt: new Date(captureStartAt),
      captureEndAt: new Date(captureEndAt),
      // `captureStatus` only reads the window; the gallery's own two fields are
      // answered by `gallery` below, which the server already resolved.
      revealAt: new Date(captureEndAt),
      guestsCanView: false,
      timeZone: 'UTC',
    },
    locale,
  )

  /**
   * Claim a frame on screen for a shot the uploader is about to start.
   *
   * Shared by the shutter and by resume, because a recovered shot is not a
   * different kind of thing: it is a photo this device took and still owes. It
   * develops in the strip exactly like a fresh one and gets the same durable
   * receipt, so a reload does not make its state mysterious.
   */
  const claimCell = useCallback(
    (id: string, source: Blob, receipt: CaptureReceiptState = 'saving') => {
      setCaptures((current) => {
        if (current.some((c) => c.id === id)) return current
        return [
          ...current,
          {
            id,
            photoId: null,
            previewUrl: URL.createObjectURL(source),
            progress: 0,
            confirmed: false,
            durable: receipt === 'stored',
            receipt,
          },
        ]
      })
    },
    [],
  )

  /**
   * The uploader itself, built once on mount and never rebuilt.
   *
   * Its rules — one shot at a time, retry the transport, give up eventually,
   * never resurrect a refused shot — live in `lib/upload-queue.ts` so they can
   * be tested. What stays here is only what is genuinely React: the developing
   * cells, the object URLs, the counter and the words.
   *
   * Built in an effect rather than during render so teardown can abort an
   * in-flight Storage request.
   */
  const queueRef = useRef<UploadQueue | null>(null)

  const reportIssue = useCallback(
    (id: string, issue: UploadIssue) => {
      // A connection or kill-switch refusal can recur every retry interval.
      // One event per capture/stage/class/finality preserves the diagnosis
      // without turning a 24-hour stored photo into thousands of events.
      const key = `${id}:${issue.stage}:${issue.failure}:${issue.terminal}`
      if (reportedIssues.current.has(key)) return
      reportedIssues.current.add(key)
      // Issues are raised while their attempt is still the queue's active
      // one. A compression failure belongs to no attempt, and the shot that is
      // running may be a different one — hence the id check.
      const flight = queueRef.current?.inFlight()
      track(
        'upload_issue',
        {
          event_id: eventId,
          capture_id: id,
          ...issue,
          ...(flight?.id === id ? { attempt_id: flight.attemptId } : {}),
        },
        { urgent: true },
      )
    },
    [eventId],
  )

  /**
   * Pick up whatever a killed tab left behind.
   *
   * Deliberately not the `handedOff` listener above: that one is scoped to the
   * camera hand-off and unmounts the moment it is over, and this has to be
   * listening precisely when the guest has been away long enough for the tab to
   * have died. `pageshow` is in the list because an iOS bfcache restore does
   * not reliably fire `visibilitychange`, and coming back from another app is
   * the exact scenario this whole feature exists for. The queue's own guard
   * makes the duplicate calls free.
   */
  useEffect(() => {
    const queue = (queueRef.current ??= createUploadQueue({
      eventId,
      deps: {
        reserve: (idempotencyKey) => reserveShotAction(eventId, idempotencyKey),
        compress: compressForStorage,
        prepare: prepareStoredShot,
        upload: uploadShotRenders,
        commit: (args) => commitShotAction({ slug, ...args }),
        release: releaseShotAction,
        store: uploadStore,
      },
      handlers: {
        onStored(id, durable) {
          setCaptures((current) =>
            current.map((c) =>
              c.id === id
                ? {
                    ...c,
                    durable: c.durable || durable,
                    receipt: durable ? 'stored' : 'memory_only',
                  }
                : c,
            ),
          )
        },
        onReserved(id, photoId) {
          reservedCaptures.current.add(id)
          setCaptures((current) =>
            current.map((c) =>
              c.id === id ? { ...c, photoId, receipt: 'uploading' } : c,
            ),
          )
        },
        onProgress(id, progress) {
          setCaptures((current) =>
            current.map((c) =>
              c.id === id
                ? {
                    ...c,
                    progress,
                    receipt: progress > 0 ? 'uploading' : c.receipt,
                  }
                : c,
            ),
          )
        },
        onConfirmed(id, shotsRemaining) {
          const now = Date.now()
          const started = startedAt.current.get(id)
          track('upload_confirmed', {
            event_id: eventId,
            capture_id: id,
            shots_remaining: shotsRemaining,
            // From the shutter (or the original capture, for a restored shot)
            // to the server saying yes. Forty seconds here is a guest who has
            // already walked away from the screen.
            elapsed_ms: started === undefined ? null : now - started,
          })
          reservedCaptures.current.delete(id)
          setRemaining(shotsRemaining)
          setCaptures((current) =>
            current.map((c) =>
              c.id === id
                ? {
                    ...c,
                    progress: 1,
                    confirmed: true,
                    receipt: 'confirmed',
                  }
                : c,
            ),
          )
          router.refresh()
        },
        onDropped(id, reason) {
          const frameWasReserved = reservedCaptures.current.delete(id)
          setCaptures((current) =>
            current.map((c) =>
              c.id === id
                ? {
                    ...c,
                    previewUrl: null,
                    progress: 0,
                    receipt: 'lost',
                  }
                : c,
            ),
          )
          // A shot nobody is waiting for any more must not be counted in a
          // receipt claiming it went up. Over-subtracting only hides the
          // receipt, which is the safe direction to be wrong in.
          setOfflineBacklog((n) => Math.max(0, n - 1))
          if (reason === 'refused') return
          setFlash(
            frameWasReserved
              ? en
                ? 'This photo could not be saved. Its frame returns within 10 minutes.'
                : 'Ezt a képet nem sikerült megőrizni. A képkocka legfeljebb 10 percen belül visszakerül.'
              : en
                ? 'This photo could not be saved. No frame was used.'
                : 'Ezt a képet nem sikerült megőrizni. Nem használtunk el képkockát.',
          )
        },
        onRefusal(refusal) {
          if (refusal === 'no_shots') setRemaining(0)
          setFlash(refusalMessage(refusal, locale))
        },
        onIssue(id, issue) {
          reportIssue(id, issue)
          if (issue.terminal) return
          setCaptures((current) =>
            current.map((c) =>
              c.id === id && !c.confirmed && c.receipt !== 'lost'
                ? { ...c, receipt: 'waiting' }
                : c,
            ),
          )
        },
        onPrepared(id, file, outcome) {
          if (!outcome.ok || outcome.ms < SLOW_PREPARATION_MS) return
          track('capture_preparation_slow', {
            event_id: eventId,
            capture_id: id,
            ms: outcome.ms,
            heic: isHeic(file),
            input_bytes: file.size,
            bytes: outcome.bytes,
            width: outcome.width,
            height: outcome.height,
          })
        },
        onDiscarded(id, reason, ageMs) {
          track(
            'upload_discarded',
            {
              event_id: eventId,
              capture_id: id,
              reason,
              age_ms: ageMs,
            },
            { urgent: true },
          )
          setCaptures((current) => {
            if (current.some((c) => c.id === id)) return current
            return [
              ...current,
              {
                id,
                photoId: null,
                previewUrl: null,
                progress: 0,
                confirmed: false,
                durable: false,
                receipt: 'lost',
              },
            ]
          })
          setFlash(discardedMessage(reason, locale))
        },
        onRestored({ id, blob, capturedAt }) {
          startedAt.current.set(id, capturedAt)
          track('upload_restored', {
            event_id: eventId,
            capture_id: id,
            age_ms: Date.now() - capturedAt,
          })
          claimCell(id, blob, 'stored')
        },
        // Telemetry only, and it may run after unmount — see the handler's
        // note in `lib/upload-queue.ts`. Nothing here may set state.
        onAttemptStep(id, step) {
          const attempt = {
            event_id: eventId,
            capture_id: id,
            attempt_id: step.attemptId,
            attempt: step.attempt,
          }
          switch (step.kind) {
            case 'uploaded':
              track(
                'upload_renders_uploaded',
                { ...attempt, upload_ms: step.ms, bytes: step.bytes },
                { urgent: true },
              )
              return
            case 'commit_started':
              track('upload_commit_started', attempt, { urgent: true })
              return
            case 'commit_finished':
              track(
                'upload_commit_finished',
                {
                  ...attempt,
                  outcome: step.outcome,
                  failure: step.failure,
                  refusal: step.refusal,
                  unsent: step.unsent,
                  commit_ms: step.ms,
                },
                { urgent: true },
              )
              return
            case 'interrupted':
              track(
                'upload_attempt_interrupted',
                { ...attempt, stage: step.stage },
                { urgent: true },
              )
              return
          }
        },
      },
    }))

    const reactivate = () => {
      if (document.visibilityState === 'hidden') return
      void queue.resume()
    }

    // Whether the guest left mid-attempt is the question a `pending` row
    // raises first, and nothing answered it. iOS may freeze or reclaim the tab
    // right after this, so the send is best effort.
    const leaving = (event: Event) => {
      const via = event.type === 'pagehide' ? 'pagehide' : 'visibilitychange'
      if (via === 'visibilitychange' && document.visibilityState !== 'hidden')
        return
      const flight = queue.inFlight()
      if (!flight) return
      track(
        'upload_backgrounded',
        {
          event_id: eventId,
          capture_id: flight.id,
          attempt_id: flight.attemptId,
          attempt: flight.attempt,
          stage: flight.stage,
          via,
        },
        { urgent: true },
      )
    }

    reactivate()
    document.addEventListener('visibilitychange', reactivate)
    document.addEventListener('visibilitychange', leaving)
    window.addEventListener('pagehide', leaving)
    window.addEventListener('pageshow', reactivate)
    window.addEventListener('online', reactivate)
    return () => {
      document.removeEventListener('visibilitychange', reactivate)
      document.removeEventListener('visibilitychange', leaving)
      window.removeEventListener('pagehide', leaving)
      window.removeEventListener('pageshow', reactivate)
      window.removeEventListener('online', reactivate)
      queue.stop()
      if (queueRef.current === queue) queueRef.current = null
    }
  }, [claimCell, en, eventId, locale, reportIssue, router, slug])

  /**
   * What the shutter does: claim a frame on screen, and get out of the way.
   *
   * The button used to stay disabled until the previous photo had committed,
   * which on a slow connection is the length of a whole moment. A roll of film
   * does not stop you pressing the shutter because the last frame is still
   * winding on.
   */
  const takePhoto = useCallback(
    (file: File) => {
      // Minted here and nowhere else. It is the shot's identity on screen, its
      // key in the store, and the idempotency key that lets a replay after a
      // reload re-claim the same frame instead of spending another.
      const id = crypto.randomUUID()
      const now = Date.now()
      startedAt.current.set(id, now)
      const opened = cameraOpenedAt.current
      cameraOpenedAt.current = null
      track('shutter_pressed', {
        event_id: eventId,
        capture_id: id,
        shots_remaining: remaining,
        outstanding,
        // How long the OS camera had the screen. Long enough, and iOS has
        // probably reclaimed the tab — the number every retry rule guesses at.
        away_ms: opened === null ? null : now - opened,
        input_bytes: file.size,
        heic: isHeic(file),
      })
      setFlash(null)
      if (!online) {
        setOfflineBacklog((n) => n + 1)
      } else if (outstanding === 0) {
        // Back on a connection with nothing owed: the last outage is over and
        // its receipt has been read. This shot starts a new story.
        setOfflineBacklog(0)
      }
      claimCell(id, file)
      queueRef.current?.enqueue(id, file, now)
    },
    [claimCell, eventId, online, remaining, outstanding],
  )

  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-3xl px-5 pt-[34px] pb-6"
      // See the note in `app/(product)/layout.tsx`: the document language is
      // the site default because this route has no locale segment, so the
      // event's own language is marked on its subtree instead.
      lang={localeTag[locale]}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(0)}
        className="flex items-center justify-between gap-3"
      >
        <span className="text-xs font-semibold tracking-[0.02em] text-foreground/55">
          OurFilm
        </span>
        {/* Two facts in one row, and they are not the same kind of fact: the
            window is the event's, the connection is this phone's. Amber says
            the second one is gone, and it wins — a guest with no signal does
            not need to be told how long the camera stays open. Lilac is left
            meaning only that the film is running. */}
        <span
          className={`inline-flex items-center gap-[7px] text-xs font-medium transition-colors ${
            !online
              ? 'text-warning'
              : status.live
                ? 'text-accent'
                : 'text-foreground/55'
          }`}
        >
          {/* Amber never breathes. The pulse means the film is running, and
              on this row that would be answering a different question. */}
          {!online || status.live ? <LiveDot pulse={online} /> : null}
          {online ? status.label : en ? 'No connection' : 'Nincs kapcsolat'}
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(1)}
        className="mt-3.5 font-display text-[34px] leading-[1.02] tracking-[-0.005em] text-balance"
      >
        {eventName}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(2)}
        className="mt-5.5 flex items-end gap-2.5"
      >
        {/* The number is the subject of the screen, and it is the same rolling
            number the create flow and the host console use. What it shows is
            `framesLeft` — see the note there for why that is not the same as a
            client-side decrement. */}
        <span aria-live="polite" className="flex items-end">
          <Odometer
            value={framesLeft}
            dir="down"
            className="font-mono text-[62px] leading-[0.82] font-medium tracking-[-0.06em] tabular-nums"
          />
        </span>
        <span className="pb-1.5 font-mono text-[19px] tracking-[-0.03em] text-foreground/35">
          /{shotsPerParticipant}
        </span>
        <span className="ml-auto pb-2 text-right text-xs leading-[1.45] font-medium text-foreground/55">
          {en ? (
            <>
              frames
              <br />
              remaining
            </>
          ) : (
            <>
              maradt
              <br />
              képkocka
            </>
          )}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(3)}
      >
        {/* The perforations keep their place in the same count and arrive on
            `advance` rather than `settle` — the strip is the one mechanical
            object on the screen, and it should read as film being pulled
            through rather than as another card landing. */}
        <FilmStrip
          className="mt-5"
          frames={frames}
          total={shotsPerParticipant}
          locale={locale}
          pending={developing}
          offline={!online}
          entrance={stage(6, T.advance)}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(4)}
        className="mt-5.5 flex items-center gap-3"
      >
        {/* The shutter dims because a boolean says the screen has been handed
            to the OS camera — never because an animation was left mid-flight.
            A guest can be away for a minute, and every frame-driven timer in
            this tab is frozen for all of it.

            The dim is the `animate` opacity rather than `disabled:opacity-50`,
            because an inline style would win over the class and the two would
            fight. Springs for the finger, a tween for the state: the scale is
            `snap` and the opacity is `settle`, named separately. */}
        <motion.button
          type="button"
          onClick={() => {
            cameraOpenedAt.current = Date.now()
            track('camera_opened', {
              event_id: eventId,
              shots_remaining: remaining,
              outstanding,
            })
            setHandedOff(true)
            inputRef.current?.click()
          }}
          disabled={!canTakePhoto}
          initial={false}
          animate={{ opacity: handedOff || !canTakePhoto ? 0.5 : 1 }}
          whileTap={
            canTakePhoto && !reduceMotion ? { scale: 0.972 } : undefined
          }
          transition={reduceMotion ? still : { ...T.snap, opacity: T.settle }}
          className="paper btn-shine flex min-h-[58px] flex-1 items-center justify-center gap-2.5 rounded-lg text-[15px] font-semibold disabled:pointer-events-none"
        >
          <Camera
            className="size-[19px]"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          {remaining <= 0
            ? en
              ? 'Roll finished'
              : 'Megtelt a tekercs'
            : uploading && !canTakePhoto
              ? // The roll is spent but the last frames are still going up.
                // The only moment this screen says "saving" — while a shot is
                // uploading with film left, the shutter still reads "Kamera",
                // because it still works.
                en
                ? 'Saving…'
                : 'Mentés…'
              : en
                ? 'Camera'
                : 'Kamera'}
        </motion.button>

        <InviteButton
          url={`${eventUrl}?lang=${locale}`}
          eventId={eventId}
          locale={locale}
          iconOnly
        />

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          disabled={!canTakePhoto}
          className="sr-only"
          aria-label={en ? 'Take a photo' : 'Fotó készítése'}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            setHandedOff(false)
            if (file) takePhoto(file)
          }}
        />
      </motion.div>

      {/* One line under the shutter, and it is one line on purpose.

          It says what the product is — the guest count, no preview, no retakes
          — until something more urgent needs the space, and then it says that
          instead: a failed upload, an outage, the receipt when the outage
          ends. Two stacked lines was the first attempt and it read as a wall;
          these are the same slot in the design's own mocks, the format line on
          the album screen and the connection line on the camera screen.

          The height is reserved in every state, which is what stops the strip
          and the counter jumping each time the wifi comes and goes. It used to
          be a pair of animated messages that entered and left, and that shape
          cannot carry an outage that lasts the whole wedding — nor the rule
          that a guest tapping the shutter repeatedly must not see motion each
          time. The entrance below fires once, on first paint; after that the
          only transition here is the colour. */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(4)}
        aria-live={flash ? 'assertive' : 'polite'}
        className={`mt-4 min-h-9 text-center text-pretty transition-colors ${
          statusLine
            ? `text-[13px] leading-[1.45] ${statusLine.tone}`
            : 'text-xs leading-[1.55] text-foreground/45'
        }`}
      >
        {statusLine ? statusLine.text : formatLine(participantCount, locale)}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(5)}
        className="mt-6.5 border-t border-border pt-4.5"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-[22px] leading-none">
            {en ? 'Shared photos' : 'Közös képek'}
          </h2>
          {gallery.open && photos.length > 0 ? (
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {en
                ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
                : `${photos.length} kép`}
            </p>
          ) : null}
        </div>

        {!gallery.open ? (
          <div className="mt-4 rounded-2xl border border-border px-6 py-8 text-center">
            <h3 className="text-base font-semibold text-balance">
              {gallery.heading}
            </h3>
            {gallery.detail ? (
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                {gallery.detail}
              </p>
            ) : null}
            {/* Two things on this screen now obey different rules — the strip
                above is this guest's own film and is never reveal-gated — so the
                lock says which is which rather than letting it read as a bug. */}
            <p className="mt-3 text-xs leading-relaxed text-pretty text-muted-foreground/70">
              {ownRollNote(locale)}
            </p>
          </div>
        ) : photos.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {en
              ? 'No photos yet. Open the camera and take the first one.'
              : 'Még nincs kép. Nyisd meg a kamerát, és készítsd el az elsőt.'}
          </p>
        ) : (
          <div className="mt-4">
            <PhotoGrid photos={photos} eventId={eventId} locale={locale} />
            {/* Below the grid, never above it: a guest who has just watched
                the album develop is the only audience this bar has, and it
                has to come after the thing it is trading on. */}
            <CreateOwnAlbum eventId={eventId} locale={locale} />
          </div>
        )}
      </motion.div>
    </main>
  )
}

/**
 * Whether this shot is still owed, and so still drawn as a developing cell.
 *
 * Before the server has granted a frame there is nothing to match on, so a
 * freshly captured shot is always developing. After that it is exactly whether
 * its own photo has come down yet — never a comparison of counts.
 */
function isDeveloping(capture: Capture, frameIds: Set<string>): boolean {
  if (capture.receipt === 'lost') return false
  return !capture.photoId || !frameIds.has(capture.photoId)
}

function isOutstanding(capture: Capture): boolean {
  return capture.receipt !== 'confirmed' && capture.receipt !== 'lost'
}

function refusalMessage(refusal: string, locale: Locale): string {
  const en = locale === 'en'
  switch (refusal) {
    case 'not_started':
      return en ? 'The camera is not open yet.' : 'A kamera még nem nyílt meg.'
    case 'ended':
      return en ? 'Shooting has ended.' : 'Véget ért a fotózás.'
    case 'no_shots':
      return en ? 'Your roll is full.' : 'Megtelt a tekercsed.'
    case 'no_session':
      return en
        ? 'Your session expired. Refresh the page.'
        : 'Lejárt a munkameneted. Frissítsd az oldalt.'
    case 'uploads_disabled':
    case 'storage_limit':
      return en
        ? 'Uploads are temporarily paused. Ask the host to contact us.'
        : 'A feltöltés átmenetileg szünetel. Kérd meg a szervezőt, hogy írjon nekünk.'
    default:
      return en
        ? 'The upload is waiting. We will retry automatically.'
        : 'A feltöltés várakozik. Automatikusan újrapróbáljuk.'
  }
}

function discardedMessage(reason: string, locale: Locale): string {
  const en = locale === 'en'
  switch (reason) {
    case 'expired':
      return en
        ? 'A photo saved on this phone expired before it reached the album. Its frame is available again within 10 minutes.'
        : 'Egy ezen a telefonon tárolt kép lejárt, mielőtt az albumba került volna. A képkocka legfeljebb 10 percen belül újra elérhető.'
    case 'empty':
    case 'unreadable':
      return en
        ? 'A saved photo became unreadable and did not reach the album. Its frame is available again within 10 minutes.'
        : 'Egy mentett kép olvashatatlanná vált, ezért nem került az albumba. A képkocka legfeljebb 10 percen belül újra elérhető.'
    default:
      return en
        ? 'A saved photo could not reach the album. Its frame is available again within 10 minutes.'
        : 'Egy mentett kép nem jutott el az albumba. A képkocka legfeljebb 10 percen belül újra elérhető.'
  }
}
