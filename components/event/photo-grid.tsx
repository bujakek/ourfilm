'use client'

import type { GalleryTile } from '@/lib/photos'
import { AnimatePresence, motion } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'
import { Lightbox } from './lightbox'

export function PhotoGrid({ photos }: { photos: GalleryTile[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <motion.ul
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.035, delayChildren: 0.04 },
          },
        }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {photos.map((photo, i) => (
          <motion.li
            key={photo.id}
            variants={{
              hidden: { opacity: 0, y: 10, scale: 0.985 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
              },
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
                alt={`${photo.uploaderName} fotója`}
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
      </motion.ul>

      <AnimatePresence>
        {openIndex !== null ? (
          <Lightbox
            photos={photos}
            index={openIndex}
            onClose={() => setOpenIndex(null)}
            onNavigate={setOpenIndex}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
