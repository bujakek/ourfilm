'use client'

import type { Frame } from '@/lib/frames'
import type { GalleryTile } from '@/lib/photos'
import { Camera, Loader2 } from 'lucide-react'
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

import { FilmStrip } from './film-strip'
import { InviteButton } from './invite-button'
import { PhotoGrid } from './photo-grid'

type GalleryState =
  { open: true } | { open: false; heading: string; detail: string | null }

type Flash = { kind: 'saved' | 'error'; message: string } | null

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])

  const captureEnd = new Date(captureEndAt).getTime()
  const captureIsOpen = initialCanCapture && now <= captureEnd
  const canTakePhoto = captureIsOpen && remaining > 0 && !busy

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
      const idempotencyKey = crypto.randomUUID()
      let photoId: string | null = null

      try {
        const reserved = await reserveShotAction(eventId, idempotencyKey)

        if (!reserved.ok) {
          if (reserved.refusal === 'no_shots') setRemaining(0)
          setFlash({
            kind: 'error',
            message: refusalMessage(reserved.refusal, locale),
          })
          return
        }

        photoId = reserved.photoId
        const prepared = await prepareForUpload(file)
        await uploadShotRenders({ prepared, uploads: reserved.uploads })

        const committed = await commitShotAction({
          slug,
          photoId,
          width: prepared.width,
          height: prepared.height,
          byteSize: prepared.full.size,
          takenAt: prepared.takenAt?.toISOString() ?? null,
        })

        if (!committed.committed) throw new Error('commit refused')

        setRemaining(committed.shotsRemaining)
        setFlash({
          kind: 'saved',
          message: en ? 'Photo saved.' : 'Elmentettük a képet.',
        })
        router.refresh()
      } catch (error) {
        console.error('Native camera upload failed', error)
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
    [busy, en, eventId, locale, remaining, router, slug],
  )

  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-3xl px-5 pt-[34px] pb-6"
      // See the note in `app/(product)/layout.tsx`: the document language is
      // the site default because this route has no locale segment, so the
      // event's own language is marked on its subtree instead.
      lang={localeTag[locale]}
    >
      <div className="flex items-center justify-between">
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
              className="size-[5px] rounded-full bg-accent"
            />
          ) : null}
          {status.label}
        </span>
      </div>

      <h1 className="mt-3 font-display text-[36px] leading-[1.02] tracking-[-0.005em] text-balance">
        {eventName}
      </h1>

      <div className="mt-6 flex items-end gap-3">
        {/* The number is the subject of the screen, so the swap animation it
            already had simply gets five times the type size. It is still not
            optimistic: this renders whatever `commit_shot` returned, because a
            client-side decrement is a display and the database is the count. */}
        <span
          aria-live="polite"
          className="relative flex h-[54px] items-end overflow-hidden font-mono text-[66px] leading-[0.82] font-medium tracking-[-0.06em]"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={remaining}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -24 }}
              transition={reduceMotion ? still : T.settle}
            >
              {remaining}
            </motion.span>
          </AnimatePresence>
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
      </div>

      <FilmStrip
        className="mt-5"
        frames={frames}
        total={shotsPerParticipant}
        locale={locale}
      />

      <div className="mt-5.5 flex items-center gap-3.5">
        <motion.button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canTakePhoto}
          whileTap={canTakePhoto && !reduceMotion ? { scale: 0.98 } : undefined}
          className="paper btn-shine flex min-h-[58px] flex-1 items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="size-5" strokeWidth={1.8} aria-hidden="true" />
          )}
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
            if (file) void uploadPhoto(file)
          }}
        />
      </div>

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
      <p className="mt-3 text-center font-mono text-[10px] tracking-[0.06em] text-foreground/35">
        {formatLine(participantCount, locale)}
      </p>

      <div className="mt-6.5 border-t border-border pt-4.5">
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
      </div>
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
