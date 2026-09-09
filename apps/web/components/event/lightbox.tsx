'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from 'motion/react'
import Image from 'next/image'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import { morphFrom } from '@/lib/photo-morph'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { track } from '@/lib/telemetry'

const SWIPE_THRESHOLD = 50

/**
 * What the viewer actually reads off a photo.
 *
 * Deliberately not `GalleryTile` or `ModerationTile`: the guest's album and the
 * host's moderation grid carry different things and both open the same viewer,
 * and the shared piece is the navigation — the dialog, the swipe threshold, the
 * arrow keys, the exit — not the row. Structural, so either fits and neither
 * has to know about the other.
 */
export type ViewablePhoto = {
  id: string
  viewUrl: string
  uploaderName: string | null
}

/**
 * One photo, full-screen, with the album either side of it.
 *
 * The host opens the same viewer as the guest and gets a footer of controls in
 * it: `actions` is where save, hide and delete live, and it is the only reason
 * this component knows there is more than one caller. A guest passes nothing
 * and sees exactly what they saw before.
 */
export function Lightbox<Photo extends ViewablePhoto>({
  photos,
  eventId,
  index,
  onClose,
  onNavigate,
  locale = 'hu',
  actions,
  dimmed = false,
  caption: captionOverride,
  originOf,
}: {
  photos: Photo[]
  /** Telemetry only. */
  eventId: string
  index: number
  onClose: () => void
  onNavigate: (next: number) => void
  locale?: Locale
  /** Rendered above the nav row. The host's moderation controls; nothing for
   *  a guest. */
  actions?: ReactNode
  /** Withheld from the album, drawn the way the grid draws it — so a host
   *  cannot mistake which frame they are looking at. */
  dimmed?: boolean
  /** Replaces the credit line under the photo. The host's version carries a
   *  time and the hidden state, which a guest has no use for. */
  caption?: string
  /**
   * Where a photo's thumbnail is on screen right now, or null if it has none.
   *
   * The grid owns this because only the grid knows where its tiles are. It is
   * asked twice: once on open, so the photo can grow out of the tile that was
   * tapped, and once on close, for whichever photo is showing by then — swipe
   * three photos along and it falls back into the third tile, not the first.
   *
   * Null is a complete answer, and the reason this is a callback rather than a
   * rect: a photo the host has just deleted has no tile left to return to, and
   * the viewer closes with a plain fade instead of flying at a gap in the grid.
   */
  originOf?: (photoId: string) => DOMRect | null
}) {
  // Mounted only while open — `AnimatePresence` removes it on close — so the
  // page is held for exactly as long as a photo is over it. It is also what
  // makes the morph below land: a grid that scrolled while the photo was open
  // would put the tile somewhere else by the time it closed.
  useScrollLock(true)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const touchStartX = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()
  const [surface, animate] = useAnimate<HTMLDivElement>()
  const closing = useRef(false)
  const photo = photos[index]

  const go = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < photos.length) onNavigate(next)
    },
    [index, photos.length, onNavigate],
  )

  /**
   * Show the dialog, and do it in a layout effect declared before the morph
   * below.
   *
   * A closed `<dialog>` is `display: none`, so everything inside it measures
   * zero. In an ordinary `useEffect` this ran *after* the morph's layout
   * effect, which meant the morph measured a box that did not exist yet and
   * computed a transform from nothing. Layout effects run in declaration
   * order; this one has to come first.
   */
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  /**
   * Grow out of the tile that was tapped.
   *
   * A layout effect, and keyframe arrays rather than a state change, because
   * both run before the browser paints — set the transform in an ordinary
   * effect and the photo appears full-size for one frame first, which is the
   * flash this whole animation exists to replace.
   *
   * `layoutId` was the obvious tool and is the wrong one here: it matches on
   * mount, so swiping to the next photo would fly it in from *its* thumbnail
   * too. Opening and closing are the only two moments that should morph, and
   * measuring the boxes ourselves is what keeps it to those two.
   *
   * **The photo morphs; the ground does not fade.** iOS fades it, and having
   * that here would mean replacing `::backdrop` with an element Motion can
   * animate. That was tried and broke the screen twice. The pseudo-element is
   * the browser's own full-viewport layer, painted between the page and the
   * dialog and impossible to mis-stack; a div has to win a stacking contest
   * against a parent that animates opacity, and when it loses the viewer's
   * chrome draws straight onto the grid with the page showing through. If the
   * fade is worth having it is a CSS transition on `::backdrop` with
   * `@starting-style` in `globals.css`, not an element in here.
   */
  useLayoutEffect(() => {
    const from = originOf?.(photo.id)
    const el = surface.current
    if (!from || !el || reduceMotion) return

    const box = el.getBoundingClientRect()
    if (box.width === 0) return

    const { x, y, scale } = morphFrom(from, box)
    void animate(
      el,
      { x: [x, 0], y: [y, 0], scale: [scale, 1], opacity: [0.7, 1] },
      T.expand,
    )
    // Once, on open. Navigating between photos is a cross-fade, not a morph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Fall back into the grid, then unmount.
   *
   * Awaited rather than handed to `AnimatePresence`: the exiting element lives
   * in the dialog's top layer, and the tile it is flying towards does not, so
   * a shared exit would hand the animation to something painting underneath
   * the backdrop. Running it here — while the viewer is still the top layer,
   * with the backdrop fading out alongside — keeps the photo visible the whole
   * way down.
   */
  const close = useCallback(async () => {
    if (closing.current) return
    closing.current = true

    const to = originOf?.(photo.id)
    const el = surface.current
    const box = el?.getBoundingClientRect()
    if (to && el && box && box.width > 0 && !reduceMotion) {
      const { x, y, scale } = morphFrom(to, box)
      await animate(el, { x, y, scale, opacity: 0.7 }, T.expand)
    }
    onClose()
  }, [animate, onClose, originOf, photo.id, reduceMotion, surface])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // Escape closes through the morph like every other way out, so the photo
    // still falls back into its tile rather than blinking away.
    const onCancel = (e: Event) => {
      e.preventDefault()
      void close()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [close])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (!photo) return null

  const credit = photo.uploaderName
    ? locale === 'en'
      ? `Photo by ${photo.uploaderName}`
      : `${photo.uploaderName} fotója`
    : locale === 'en'
      ? 'Photo'
      : 'Fotó'
  const caption = captionOverride ?? credit

  return (
    <dialog
      ref={dialogRef}
      aria-label={locale === 'en' ? 'Photo viewer' : 'Fotó nagyban'}
      className="max-h-none max-w-none bg-transparent backdrop:bg-black/90 backdrop:backdrop-blur-sm"
      onClose={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current
        touchStartX.current = null
        if (start === null) return
        const dx = (e.changedTouches[0]?.clientX ?? start) - start
        if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx > 0 ? -1 : 1)
      }}
    >
      {/* Opacity only. It used to scale as well, which is now the morph's job
          — and scaling the whole surface moved the chrome with the photo. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reduceMotion ? still : T.settle}
        className="fixed inset-0 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-white/70">
            {index + 1} / {photos.length}
          </p>
          <motion.button
            type="button"
            onClick={() => void close()}
            whileTap={{ scale: 0.9 }}
            aria-label={locale === 'en' ? 'Close' : 'Bezárás'}
            className="glass flex size-11 items-center justify-center rounded-full text-white"
          >
            <X className="size-5" />
          </motion.button>
        </div>

        <div ref={surface} className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={T.settle}
              className="absolute inset-0"
            >
              <Image
                src={photo.viewUrl}
                alt={credit}
                fill
                sizes="100vw"
                unoptimized
                onError={() =>
                  // The same expiry as the grid's, one render up: a `view`
                  // URL signed an hour ago for a lightbox opened now. Worth
                  // separating, because here the guest is looking at one photo
                  // deliberately rather than scrolling past a gap.
                  track('gallery_image_failed', {
                    event_id: eventId,
                    surface: 'lightbox',
                  })
                }
                className={`object-contain transition-opacity ${
                  dimmed ? 'opacity-50 grayscale' : ''
                }`}
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {actions ? <div className="px-4 pt-2">{actions}</div> : null}

        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <motion.button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            whileTap={index === 0 ? undefined : { scale: 0.9 }}
            aria-label={locale === 'en' ? 'Previous photo' : 'Előző kép'}
            className="glass flex size-12 items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-6" />
          </motion.button>
          <p className="min-w-0 truncate text-center text-sm text-white/70">
            {caption}
          </p>
          <motion.button
            type="button"
            onClick={() => go(1)}
            disabled={index === photos.length - 1}
            whileTap={index === photos.length - 1 ? undefined : { scale: 0.9 }}
            aria-label={locale === 'en' ? 'Next photo' : 'Következő kép'}
            className="glass flex size-12 items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronRight className="size-6" />
          </motion.button>
        </div>
      </motion.div>
    </dialog>
  )
}
