'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { T } from '@/lib/motion'
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
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const touchStartX = useRef<number | null>(null)
  const photo = photos[index]

  const go = useCallback(
    (delta: number) => {
      const next = index + delta
      if (next >= 0 && next < photos.length) onNavigate(next)
    },
    [index, photos.length, onNavigate],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()

    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose])

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
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={T.settle}
        className="fixed inset-0 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-white/70">
            {index + 1} / {photos.length}
          </p>
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            aria-label={locale === 'en' ? 'Close' : 'Bezárás'}
            className="glass flex size-11 items-center justify-center rounded-full text-white"
          >
            <X className="size-5" />
          </motion.button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
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
