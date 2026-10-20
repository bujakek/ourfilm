'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { T } from '@/lib/motion'
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
 * The host opens the same viewer as the guest and fills its slots: `heading`
 * (who took it and when), `overlay` (the hidden label) and `actions` (hide,
 * save, delete). Passing a `heading` is what switches the frame to the host's
 * layout — close at the left, the count at the right, the controls in a
 * footer bar — and it is the only reason this component knows there is more
 * than one caller. A guest passes none of them and sees the viewer as before.
 */
export function Lightbox<Photo extends ViewablePhoto>({
  photos,
  eventId,
  index,
  onClose,
  onNavigate,
  locale = 'hu',
  heading,
  overlay,
  actions,
  dimmed = false,
}: {
  photos: Photo[]
  /** Telemetry only. */
  eventId: string
  index: number
  onClose: () => void
  onNavigate: (next: number) => void
  locale?: Locale
  /** The host's top line: uploader and time. Its presence selects the host
   *  layout, in which the credit line under the photo is not drawn. */
  heading?: ReactNode
  /** Drawn over the top of the photo. The host's hidden label. */
  overlay?: ReactNode
  /** The footer under the photo. The host's moderation bar; nothing for a
   *  guest. */
  actions?: ReactNode
  /** Withheld from the album: the photo is dimmed, so a host cannot mistake
   *  which frame they are looking at. */
  dimmed?: boolean
}) {
  // Mounted only while open — `AnimatePresence` removes it on close — so the
  // page is held for exactly as long as a photo is over it.
  useScrollLock(true)
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
  const host = heading !== undefined

  const counter = host ? (
    <p className="host-figure shrink-0 text-[22px] leading-none whitespace-nowrap text-white">
      {index + 1}
      <span className="text-white/60"> / {photos.length}</span>
    </p>
  ) : (
    <p className="text-sm text-white/70">
      {index + 1} / {photos.length}
    </p>
  )

  const close = (
    <motion.button
      type="button"
      onClick={onClose}
      whileTap={{ scale: 0.9 }}
      aria-label={locale === 'en' ? 'Close' : 'Bezárás'}
      className={`flex size-11 shrink-0 items-center justify-center text-white backdrop-blur-md ${
        host ? 'rounded-[14px] bg-white/12' : 'rounded-full bg-white/12'
      }`}
    >
      <X className="size-5" />
    </motion.button>
  )

  const previous = (
    <motion.button
      type="button"
      onClick={() => go(-1)}
      disabled={index === 0}
      whileTap={index === 0 ? undefined : { scale: 0.9 }}
      aria-label={locale === 'en' ? 'Previous photo' : 'Előző kép'}
      className="flex size-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md disabled:opacity-30"
    >
      <ChevronLeft className="size-6" />
    </motion.button>
  )

  const next = (
    <motion.button
      type="button"
      onClick={() => go(1)}
      disabled={index === photos.length - 1}
      whileTap={index === photos.length - 1 ? undefined : { scale: 0.9 }}
      aria-label={locale === 'en' ? 'Next photo' : 'Következő kép'}
      className="flex size-12 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-md disabled:opacity-30"
    >
      <ChevronRight className="size-6" />
    </motion.button>
  )

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
        {host ? (
          <div className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
            {close}
            <div className="min-w-0 flex-1">{heading}</div>
            {counter}
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3">
            {counter}
            {close}
          </div>
        )}

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
                  dimmed ? 'opacity-55' : ''
                }`}
                priority
              />
            </motion.div>
          </AnimatePresence>
          {overlay ? (
            <div className="pointer-events-none absolute top-2 left-4 z-10 max-w-[calc(100%-2rem)]">
              {overlay}
            </div>
          ) : null}
        </div>

        {host ? (
          // Swipe and the arrow keys carry a phone; a pointer gets arrows.
          <>
            <div className="pointer-events-none absolute inset-x-3 top-1/2 hidden -translate-y-1/2 justify-between sm:flex [&>*]:pointer-events-auto">
              {previous}
              {next}
            </div>
            {actions ? (
              <div className="px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                {actions}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {actions ? <div className="px-4 pt-2">{actions}</div> : null}
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              {previous}
              <p className="min-w-0 truncate text-center text-sm text-white/70">
                {credit}
              </p>
              {next}
            </div>
          </>
        )}
      </motion.div>
    </dialog>
  )
}
