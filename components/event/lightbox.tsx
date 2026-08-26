'use client'

import type { GalleryTile } from '@/lib/photos'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
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
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
            aria-label="Bezárás"
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
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <Image
                src={photo.viewUrl}
                alt={caption}
                fill
                sizes="100vw"
                unoptimized
                className="object-contain"
                priority
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <motion.button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            whileTap={index === 0 ? undefined : { scale: 0.9 }}
            aria-label="Előző kép"
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
            aria-label="Következő kép"
            className="glass flex size-12 items-center justify-center rounded-full text-white disabled:opacity-30"
          >
            <ChevronRight className="size-6" />
          </motion.button>
        </div>
      </motion.div>
    </dialog>
  )
}
