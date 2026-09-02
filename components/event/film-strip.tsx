'use client'

import { AnimatePresence, motion, type Transition } from 'motion/react'
import Image from 'next/image'
import { useEffect, useRef } from 'react'

import type { Frame } from '@/lib/frames'
import type { Locale } from '@/lib/i18n'
import { T } from '@/lib/motion'

/**
 * The roll, drawn as film.
 *
 * The product's one idea is a fixed number of frames with no preview and no
 * retake, and until this element that idea appeared exactly once on the guest's
 * screen — as the words "24 képed maradt", third in a list of three visually
 * identical rows. Scarcity you can see is the whole point of the strip: the
 * exposed cells hold this guest's own photos, the rest are numbered blanks, and
 * the boundary between them is the thing a guest is actually deciding about
 * when they think "should I take this one".
 *
 * It shows the caller's **own** frames, not the shared gallery, and that read is
 * deliberately not reveal-gated (`lib/frames.ts`). The gallery below it still
 * is.
 */

/**
 * 52px cell, 4px gap — and the perforations are 8px on a 6px gap, so their
 * pitch divides a frame's exactly four times. That is what keeps the two rows
 * in register at any roll length without either one measuring the other.
 */
const CELL = 52
const CELL_GAP = 4
const PERFS_PER_FRAME = 4

/**
 * A frame that has been claimed but not yet confirmed.
 *
 * `previewUrl` is an object URL for the file the OS camera just handed over —
 * the only copy of the photo that exists on this device, and the reason there
 * is no spinner anywhere on this screen. The cell fills with it immediately at
 * full blur and resolves as the bytes land, so the development *is* the
 * progress indicator.
 */
export type PendingFrame = {
  previewUrl: string
  /** 0–1, the fraction of the shot's bytes that have reached Storage. */
  progress: number
  /** True only once `commit_shot` has returned. */
  confirmed: boolean
}

export function FilmStrip({
  frames,
  total,
  locale,
  pending = null,
  entrance,
  className,
}: {
  /** The exposed frames, oldest first. */
  frames: Frame[]
  /** The host's roll length — how many cells the strip has in all. */
  total: number
  locale: Locale
  pending?: PendingFrame | null
  /** How the perforation rows arrive. See the note at the call site. */
  entrance?: Transition
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  // A claimed frame is a spent frame: `reserve_shot` took it inside the row
  // lock before a single byte was uploaded, so it counts here the moment the
  // shutter is handed off, not when the server confirms.
  const exposed = frames.length + (pending ? 1 : 0)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Park the exposed/unexposed boundary against the right edge. A 24-frame
    // roll is 1344px of strip against about 350px of phone, so leaving the
    // scroll at zero would mean a guest never sees the frame they just took —
    // the one part of this element that changes.
    //
    // `scrollLeft` rather than `scrollIntoView`: the latter walks up to the
    // nearest scrollable ancestor as well, which on a short page is the
    // document, and jumping the whole page after a capture is not what anyone
    // asked for. Assignment is also instant, so there is no animation for
    // `prefers-reduced-motion` to have an opinion about.
    const boundary = exposed * (CELL + CELL_GAP)
    el.scrollLeft = Math.max(0, boundary + CELL - el.clientWidth)
  }, [exposed])

  const cells = Array.from({ length: total }, (_, i) => frames[i] ?? null)

  return (
    <div className={className}>
      {/* The strip restates the counter above it in pictures, so it is hidden
          from assistive tech rather than read out as two dozen cells. The one
          sentence below is the accessible equivalent, and it is the same two
          numbers the 66px counter already carries. */}
      <p className="sr-only">
        {locale === 'en'
          ? `${exposed} of ${total} frames used.`
          : `${total} képkockából ${exposed} elhasználva.`}
      </p>

      <div
        ref={scroller}
        aria-hidden="true"
        className="film [scroll-snap-type:x_mandatory] [scrollbar-width:none] overflow-x-auto rounded-xs py-1.5 [&::-webkit-scrollbar]:hidden"
      >
        <Perforations count={total * PERFS_PER_FRAME} entrance={entrance} />

        <div className="flex gap-1 px-2 py-1.5">
          {cells.map((frame, i) =>
            frame ? (
              <span
                key={`frame-${i}`}
                className="relative size-13 shrink-0 snap-start overflow-hidden rounded-xs bg-white/8"
              >
                {frame.thumbUrl ? (
                  <Image
                    src={frame.thumbUrl}
                    alt=""
                    fill
                    sizes="52px"
                    unoptimized
                    className="object-cover"
                  />
                ) : null}
              </span>
            ) : pending && i === frames.length ? (
              <DevelopingCell key={`frame-${i}`} pending={pending} />
            ) : (
              <span
                key={`frame-${i}`}
                className="flex size-13 shrink-0 snap-start items-end justify-end rounded-xs border border-white/10 p-[3px] font-mono text-[8px] text-white/20"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            ),
          )}
        </div>

        <Perforations count={total * PERFS_PER_FRAME} entrance={entrance} />
      </div>
    </div>
  )
}

/**
 * The frame the guest just spent, developing.
 *
 * It never reaches clear on its own. The blur bottoms out short of zero while
 * the request is still open and only snaps clear on the server's 200 — because
 * a photograph that finished developing above a pending upload is a lie, and
 * this cell is the only thing telling the guest their shot is safe.
 */
function DevelopingCell({ pending }: { pending: PendingFrame }) {
  const { previewUrl, progress, confirmed } = pending

  return (
    <span className="relative size-13 shrink-0 snap-start overflow-hidden rounded-xs bg-white/8">
      <motion.span
        className="absolute inset-0 block"
        initial={{ filter: 'grayscale(1) blur(6px)' }}
        animate={{
          filter: confirmed
            ? 'grayscale(0) blur(0px)'
            : `grayscale(${1 - 0.6 * progress}) blur(${6 - 4.6 * progress}px)`,
        }}
        transition={confirmed ? T.settle : T.develop}
      >
        {/* A local object URL, so `next/image` has nothing to optimise and no
            dimensions to reason about. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" className="size-full object-cover" />
      </motion.span>

      <AnimatePresence>
        {confirmed ? (
          <motion.span
            initial={{ opacity: 0, scale: 1.14 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={T.settle}
            className="absolute inset-0 rounded-xs ring-[1.5px] ring-accent ring-inset"
          />
        ) : null}
      </AnimatePresence>
    </span>
  )
}

function Perforations({
  count,
  entrance,
}: {
  count: number
  entrance?: Transition
}) {
  if (!entrance) {
    return (
      <div className="flex gap-1.5 px-2">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="film-perf h-[5px] w-2 shrink-0 rounded-[1.5px]"
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      className="flex gap-1.5 px-2"
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={entrance}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="film-perf h-[5px] w-2 shrink-0 rounded-[1.5px]"
        />
      ))}
    </motion.div>
  )
}
