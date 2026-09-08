'use client'

import type { GalleryTile } from '@/lib/photos'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useState } from 'react'
import { Lightbox } from './lightbox'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'
import { track } from '@/lib/telemetry'

export function PhotoGrid({
  photos,
  eventId,
  locale = 'hu',
}: {
  photos: GalleryTile[]
  /** Telemetry only. */
  eventId: string
  locale?: Locale
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const reduceMotion = useReducedMotion()

  // The reveal pass — the whole album arriving at once because the gallery has
  // just opened — is a first paint, and only a first paint gets a stagger.
  // A tile that shows up later is one guest's single new photo, and it enters
  // on its own immediately; replaying an assembly for it would announce
  // somebody else's shutter as if it were yours.
  const [revealed] = useState(() => new Set(photos.map((photo) => photo.id)))

  return (
    <>
      {/* Three columns, not two: at 390px that is 122px tiles, still well
          inside what a ~400px `thumb_path` can fill, and a contact sheet reads
          as a shared roll where a two-up grid reads as a feed. */}
      <ul className="grid grid-cols-3 gap-1.5">
        {photos.map((photo, i) => (
          <motion.li
            key={photo.id}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={
              reduceMotion
                ? still
                : {
                    ...T.settle,
                    delay: revealed.has(photo.id) ? Math.min(i, 10) * 0.06 : 0,
                  }
            }
          >
            <motion.button
              type="button"
              onClick={() => {
                setOpenIndex(i)
                // The payoff of the whole format, and the one part of the
                // guest funnel that was never measured: the reveal opens
                // because a request arrives after an instant, and until this
                // there was no way to tell whether anybody came back to look.
                track('gallery_photo_opened', {
                  event_id: eventId,
                  index: i,
                  photos: photos.length,
                })
              }}
              whileTap={reduceMotion ? undefined : { scale: 0.975 }}
              transition={reduceMotion ? still : T.snap}
              className="group relative block aspect-square w-full overflow-hidden rounded-sm"
            >
              <Tile
                photo={photo}
                eventId={eventId}
                locale={locale}
                reduceMotion={reduceMotion}
              />
            </motion.button>
          </motion.li>
        ))}
      </ul>

      <AnimatePresence>
        {openIndex !== null ? (
          <Lightbox
            photos={photos}
            eventId={eventId}
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

/**
 * The photograph itself, developing.
 *
 * The tile lands first and the image resolves inside it, which is the one
 * distinction worth drawing here: the cell arriving is layout, and the picture
 * appearing is the product's whole subject. So the tile is on `settle` and
 * what it holds is on `develop`.
 *
 * The 1.04 scale is not decoration — a blur inside `overflow-hidden` pulls
 * transparent edges into frame, and oversizing by exactly enough hides them
 * until the blur is gone. `onError` resolves it too: a tile that cannot load
 * should end up an honest empty square rather than a permanent smudge.
 */
function Tile({
  photo,
  eventId,
  locale,
  reduceMotion,
}: {
  photo: GalleryTile
  eventId: string
  locale: Locale
  reduceMotion: boolean | null
}) {
  const [developed, setDeveloped] = useState(false)

  return (
    <motion.span
      className="absolute inset-0 block"
      initial={{ filter: 'grayscale(1) blur(8px)', scale: 1.04 }}
      animate={
        developed
          ? { filter: 'grayscale(0) blur(0px)', scale: 1 }
          : { filter: 'grayscale(1) blur(8px)', scale: 1.04 }
      }
      transition={reduceMotion ? still : T.develop}
    >
      <Image
        src={photo.thumbUrl}
        alt={
          photo.uploaderName
            ? locale === 'en'
              ? `Photo by ${photo.uploaderName}`
              : `${photo.uploaderName} fotója`
            : locale === 'en'
              ? 'Photo'
              : 'Fotó'
        }
        fill
        sizes="(max-width: 640px) 50vw, 33vw"
        unoptimized
        onLoad={() => setDeveloped(true)}
        onError={() => {
          setDeveloped(true)
          // A photo the guest can see a space for and not the photo. URLs
          // are public and never expire, so this is a missing object or the
          // network — and from the page it is indistinguishable from a photo
          // that was never there, which is why it is reported.
          track('gallery_image_failed', { event_id: eventId, surface: 'grid' })
        }}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    </motion.span>
  )
}
