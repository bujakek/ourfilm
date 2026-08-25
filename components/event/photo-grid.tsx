'use client'

import type { GalleryTile } from '@/lib/photos'
import Image from 'next/image'
import { useState } from 'react'
import { Lightbox } from './lightbox'

export function PhotoGrid({ photos }: { photos: GalleryTile[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-2xl"
            >
              <Image
                // The tile, never the full image. A 4096px/~2MB file scaled
                // into a 180px box would mean a guest pulling well over a
                // gigabyte to scroll a full album — and blowing the storage
                // egress budget along the way.
                //
                // The URL is signed and short-lived: the bucket is private, so
                // this is a capability the server handed over rather than an
                // address anyone can build.
                src={photo.thumbUrl}
                alt={`${photo.uploaderName} fotója`}
                fill
                sizes="(max-width: 640px) 50vw, 33vw"
                // Already sized and compressed on the phone that produced it.
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Photo credit. The scrim is not decoration — the caption sits
                  over whatever the guest happened to photograph, and white
                  text on a bright sky is unreadable without it. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-left"
              >
                <span className="block truncate text-[11px] font-medium text-white/90">
                  {photo.uploaderName}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      ) : null}
    </>
  )
}
