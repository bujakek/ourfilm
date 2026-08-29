'use client'

import type { GalleryTile } from '@/lib/photos'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'
import { Lightbox } from './lightbox'
import type { Locale } from '@/lib/i18n'

export function PhotoGrid({
  photos,
  locale = 'hu',
}: {
  photos: GalleryTile[]
  locale?: Locale
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <motion.li
            key={photo.id}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.28,
              delay: Math.min(i, 10) * 0.025,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <motion.button
              type="button"
              onClick={() => setOpenIndex(i)}
              whileTap={{ scale: 0.975 }}
              className="group relative block aspect-square w-full overflow-hidden rounded-2xl"
            >
              <Image
                src={photo.thumbUrl}
                alt={
                  locale === 'en'
                    ? `Photo by ${photo.uploaderName}`
                    : `${photo.uploaderName} fotója`
                }
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-left"
              >
                <span className="block truncate text-[11px] font-medium text-white/90">
                  {photo.uploaderName}
                </span>
              </span>
            </motion.button>
          </motion.li>
        ))}
      </ul>

      <AnimatePresence>
        {openIndex !== null ? (
          <Lightbox
            photos={photos}
            locale={locale}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
            onNavigate={setOpenIndex}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
