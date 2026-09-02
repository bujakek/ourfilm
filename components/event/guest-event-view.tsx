'use client'

import type { Frame } from '@/lib/frames'
import type { GalleryTile } from '@/lib/photos'
import { Camera } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useRef } from 'react'

import {
  commitShotAction,
  releaseShotAction,
  reserveShotAction,
} from '@/app/(product)/e/[slug]/actions'
import { captureStatus, formatLine, ownRollNote } from '@/lib/event-copy'
import { prepareForUpload } from '@/lib/image'
import { uploadShotRenders } from '@/lib/upload-shot'
import { type Locale, localeTag } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import { useEntrance } from '@/lib/use-entrance'
import { Odometer } from '@/components/ui/odometer'

import { FilmStrip } from './film-strip'
import { InviteButton } from './invite-button'
import { PhotoGrid } from './photo-grid'

type GalleryState =
  { open: true } | { open: false; heading: string; detail: string | null }

type Flash = { kind: 'saved' | 'error'; message: string } | null

/**
 * The shot in flight, from the shutter to the server's 200.
 *
 * `index` is where the frame sits on the roll — captured at the moment the
 * shot was reserved, so the cell can hand itself back to the real frame when
 * `router.refresh()` brings it down.
 */
type Capture = {
  previewUrl: string
  index: number
  progress: number
  confirmed: boolean
}

/**
 * The live dot's breath: the one looping animation in the product.
 *
 * A period, not a transition, which is why it is here rather than in
 * `lib/motion.ts` — and rule 7 is what keeps it the only one. A second
 * looping element and neither of them means anything.
 */
const BREATH = { duration: 2.4, repeat: Infinity, ease: 'easeOut' } as const

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
  const [remaining, setRemaining] = useState(initialShotsRemaining)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const [now, setNow] = useState(initialNow)
  const [handedOff, setHandedOff] = useState(false)
  const [capture, setCapture] = useState<Capture | null>(null)

  // Once per session, not once per mount. This page is left and re-entered on
  // every single shot — see `lib/use-entrance.ts`.
  const stage = useEntrance({ once: `ourfilm:entered:${slug}`, step: 0.045 })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

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

  const previewUrl = capture?.previewUrl ?? null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])

  const captureEnd = new Date(captureEndAt).getTime()
  const captureIsOpen = initialCanCapture && now <= captureEnd
  const canTakePhoto = captureIsOpen && remaining > 0 && !busy

  // Derived rather than cleared in an effect: once `router.refresh()` has
  // brought the real frame down, the strip renders that instead and the
  // developing cell simply stops being shown. The object URL is released by
  // the effect above, keyed on the URL itself so a progress update cannot
  // revoke a photo that is still uploading.
  const pending = capture && frames.length <= capture.index ? capture : null

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

  const uploadPhoto = useCallback(
    async (file: File) => {
      if (busy || remaining <= 0) return

      setBusy(true)
      setFlash(null)

      // The cell fills with the file the camera just handed over, before a
      // single byte has been sent. That development is the progress
      // indicator, which is why there is no spinner anywhere on this screen.
      const url = URL.createObjectURL(file)
      const own = (next: (capture: Capture) => Capture) =>
        setCapture((current) =>
          current && current.previewUrl === url ? next(current) : current,
        )
      setCapture({
        previewUrl: url,
        index: frames.length,
        progress: 0,
        confirmed: false,
      })

      const idempotencyKey = crypto.randomUUID()
      let photoId: string | null = null

      try {
        const reserved = await reserveShotAction(eventId, idempotencyKey)

        if (!reserved.ok) {
          setCapture(null)
          if (reserved.refusal === 'no_shots') setRemaining(0)
          setFlash({
            kind: 'error',
            message: refusalMessage(reserved.refusal, locale),
          })
          return
        }

        photoId = reserved.photoId
        const prepared = await prepareForUpload(file)
        await uploadShotRenders({
          prepared,
          uploads: reserved.uploads,
          onProgress: (progress) => own((c) => ({ ...c, progress })),
        })

        const committed = await commitShotAction({
          slug,
          photoId,
          width: prepared.width,
          height: prepared.height,
          byteSize: prepared.full.size,
          takenAt: prepared.takenAt?.toISOString() ?? null,
        })

        if (!committed.committed) throw new Error('commit refused')

        // State lands first and the animation is a consequence: the counter is
        // set to what the server returned and the odometer rolls from an
        // already-correct value. Nothing here is gated on an animation
        // finishing — `onAnimationComplete` never fires while the tab is
        // hidden, and this tab has just spent a minute hidden behind a camera.
        setRemaining(committed.shotsRemaining)
        own((c) => ({ ...c, progress: 1, confirmed: true }))
        setFlash({
          kind: 'saved',
          message: en ? 'Photo saved.' : 'Elmentettük a képet.',
        })
        router.refresh()
      } catch (error) {
        console.error('Native camera upload failed', error)
        setCapture(null)
        if (photoId) await releaseShotAction(photoId)
        setFlash({
          kind: 'error',
          message: en
            ? 'The photo did not upload. Please try again.'
            : 'A kép nem töltődött fel. Próbáld újra.',
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, en, eventId, frames.length, locale, remaining, router, slug],
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
        className="flex items-center justify-between"
      >
        <span className="font-mono text-[9.5px] font-medium tracking-[0.18em] text-foreground/40">
          OURFILM
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[9.5px] font-medium tracking-[0.14em] ${
            status.live ? 'text-accent' : 'text-foreground/40'
          }`}
        >
          {status.live ? (
            <span
              aria-hidden="true"
              className="relative flex size-[5px] items-center justify-center"
            >
              {/* The event is happening, said as a pulse rather than a word.
                  It is the only looping animation in the product. */}
              {reduceMotion ? null : (
                <motion.span
                  animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                  transition={BREATH}
                  className="absolute size-[5px] rounded-full bg-accent"
                />
              )}
              <span className="size-[5px] rounded-full bg-accent" />
            </span>
          ) : null}
          {status.label}
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(1)}
        className="mt-3 font-display text-[36px] leading-[1.02] tracking-[-0.005em] text-balance"
      >
        {eventName}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(2)}
        className="mt-6 flex items-end gap-3"
      >
        {/* The number is the subject of the screen, and it is the same rolling
            number the create flow and the host console use. It is still not
            optimistic: this renders whatever `commit_shot` returned, because a
            client-side decrement is a display and the database is the count. */}
        <span aria-live="polite" className="flex items-end">
          <Odometer
            value={remaining}
            dir="down"
            className="font-mono text-[66px] leading-[0.82] font-medium tracking-[-0.06em]"
          />
        </span>
        <span className="pb-1.5 font-mono text-[20px] tracking-[-0.03em] text-foreground/35">
          /{shotsPerParticipant}
        </span>
        <span className="ml-auto pb-2 text-right font-mono text-[9.5px] leading-[1.5] font-medium tracking-[0.14em] text-foreground/50">
          {en ? (
            <>
              FRAMES
              <br />
              REMAINING
            </>
          ) : (
            <>
              MARADT
              <br />
              KÉPKOCKA
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
          pending={pending}
          entrance={stage(6, T.advance)}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(4)}
        className="mt-5.5 flex items-center gap-3.5"
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
          className="paper btn-shine flex min-h-[58px] flex-1 items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold disabled:pointer-events-none"
        >
          <Camera className="size-5" strokeWidth={1.8} aria-hidden="true" />
          {busy
            ? en
              ? 'Saving…'
              : 'Mentés…'
            : remaining <= 0
              ? en
                ? 'Roll finished'
                : 'Elfogyott a tekercs'
              : en
                ? 'Camera'
                : 'Kamera'}
        </motion.button>

        <InviteButton
          url={`${eventUrl}?lang=${locale}`}
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
            if (file) void uploadPhoto(file)
          }}
        />
      </motion.div>

      <AnimatePresence initial={false} mode="wait">
        {flash ? (
          <motion.p
            key={`${flash.kind}-${flash.message}`}
            aria-live="polite"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={reduceMotion ? still : T.settle}
            className={`mt-3 text-center text-sm ${
              flash.kind === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {flash.message}
          </motion.p>
        ) : remaining <= 0 ? (
          <motion.p
            key="out-of-shots"
            aria-live="polite"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? still : T.settle}
            className="mt-3 text-center text-sm font-medium text-muted-foreground"
          >
            {en
              ? 'Your roll is full.'
              : 'Elfogytak a képeid — a tekercsed megtelt.'}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* The format, said out loud. The guest count moved here from the deleted
          `<dl>`; the other two clauses are the thing the whole product is and
          had never appeared on the screen holding the camera. */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={stage(4)}
        className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-foreground/35"
      >
        {formatLine(participantCount, locale)}
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
            <p className="font-mono text-[10px] tracking-[0.1em] text-foreground/40">
              {en ? `${photos.length} PHOTOS` : `${photos.length} KÉP`}
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
            <PhotoGrid photos={photos} locale={locale} />
          </div>
        )}
      </motion.div>
    </main>
  )
}

function refusalMessage(refusal: string, locale: Locale): string {
  const en = locale === 'en'
  switch (refusal) {
    case 'not_started':
      return en ? 'The camera is not open yet.' : 'A kamera még nem nyílt meg.'
    case 'ended':
      return en ? 'Shooting has ended.' : 'Véget ért a fotózás.'
    case 'no_shots':
      return en ? 'Your roll is full.' : 'Elfogytak a képeid.'
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
        ? 'The photo did not upload. Please try again.'
        : 'A kép nem töltődött fel. Próbáld újra.'
  }
}
