'use client'

import type { GalleryTile } from '@/lib/photos'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef } from 'react'

const SWIPE_THRESHOLD = 50

export function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: GalleryTile[]
  index: number
  onClose: () => void
  onNavigate: (next: number) => void
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

  // A native <dialog> opened with showModal() gives us the focus trap, the
  // inert background and Escape-to-close for free. Rebuilding those by hand is
  // where homegrown lightboxes usually get accessibility wrong.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()

    const onCancel = (e: Event) => {
      e.preventDefault() // skip the browser's own close so state stays in sync
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

  // Every photo has a participant now, and joining requires a name, so the
  // credit is always a real one rather than a maybe.
  const caption = `${photo.uploaderName} fotója`

  return (
    <dialog
      ref={dialogRef}
      aria-label="Fotó nagyban"
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
      <div className="fixed inset-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-white/70">
            {index + 1} / {photos.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="glass flex size-11 items-center justify-center rounded-full text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Image
            key={photo.id}
            // The ~1600px render, not the print master. Showing the master
            // here meant decoding 12.6 megapixels — roughly 50MB of bitmap —
            // on the phone for every swipe, to fill a screen that is about
            // 1200px across. Which render this is was resolved server-side,
            // along with the signature that makes it fetchable at all.
            src={photo.viewUrl}
            alt={caption}
            fill
            sizes="100vw"
            // Already compressed to spec on the guest's phone; re-optimising
            // costs Vercel quota and adds latency for no visible gain.
            unoptimized
            className="object-contain"
            priority
          />
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Előző kép"
            className="glass flex size-12 items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronLeft className="size-6" />
          </button>
          <p className="min-w-0 truncate text-center text-sm text-white/70">
            {caption}
          </p>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === photos.length - 1}
            aria-label="Következő kép"
            className="glass flex size-12 items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>
    </dialog>
  )
}
