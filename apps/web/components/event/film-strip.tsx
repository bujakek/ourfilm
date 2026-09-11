'use client'

import {
  CloudUpload,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
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
 * There can be more than one: the shutter does not wait for an upload to
 * finish, so a guest shooting a toast on venue wifi may have two or three
 * cells developing at once.
 *
 * `previewUrl` is an object URL for the file the OS camera just handed over —
 * the only copy of the photo that exists on this device, and the reason there
 * is no spinner anywhere on this screen. The cell fills with it immediately at
 * full blur and resolves as the bytes land, so the development *is* the
 * progress indicator.
 */
/**
 * Where a shot has got to, from the shutter to the album.
 *
 * Owned here because this is the only thing that draws it. `saving` and
 * `stored` are about this phone; `uploading` and `confirmed` are about the
 * server; `memory_only` is the one that matters most — IndexedDB refused, so
 * the tab is the photo's only home and closing it loses the picture.
 */
export type CaptureReceiptState =
  | 'saving'
  | 'stored'
  | 'uploading'
  | 'waiting'
  | 'confirmed'
  | 'memory_only'
  | 'lost'

export type PendingFrame = {
  previewUrl: string
  /** 0–1, the fraction of the shot's bytes that have reached Storage. */
  progress: number
  /** True only once `commit_shot` has returned. */
  confirmed: boolean
  /** Where this shot has got to, drawn as a mark over the frame itself. */
  receipt: CaptureReceiptState
  /** Whether IndexedDB has acknowledged a copy that outlives this tab. */
  durable: boolean
}

export function FilmStrip({
  frames,
  total,
  locale,
  pending = [],
  offline = false,
  entrance,
  className,
}: {
  /** The exposed frames, oldest first. */
  frames: Frame[]
  /** The host's roll length — how many cells the strip has in all. */
  total: number
  locale: Locale
  /** Frames claimed but not yet landed, oldest first. Usually none or one. */
  pending?: PendingFrame[]
  /**
   * Whether the device has a connection. A developing cell that cannot upload
   * yet drops to 45% — the only new signal in the offline state, and the one
   * that separates "still going up" from "waiting for signal" at a glance.
   * The grayscale-blur underneath is unchanged: it means "not developed", and
   * that is true either way.
   */
  offline?: boolean
  /** How the perforation rows arrive. See the note at the call site. */
  entrance?: Transition
  className?: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  // A claimed frame is a spent frame: `reserve_shot` took it inside the row
  // lock before a single byte was uploaded, so it counts here the moment the
  // shutter is handed off, not when the server confirms.
  const exposed = frames.length + pending.length

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

      {/* The marks over the frames are the sighted half of this; the strip
          itself is `aria-hidden`, so without a line here a screen-reader user
          would be the only person on the page not told that a photo is at
          risk. Announced politely: it changes while a guest is shooting, and
          interrupting them mid-shutter is not the point. */}
      <p className="sr-only" role="status" aria-live="polite">
        {pendingSummary(pending, offline, locale)}
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
            ) : pending[i - frames.length] ? (
              <DevelopingCell
                key={`frame-${i}`}
                pending={pending[i - frames.length]}
                offline={offline}
              />
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
 * a photograph that finished developing above a pending upload is a lie.
 *
 * The state rides **on the frame** rather than beside it. A row of labelled
 * chips under the strip could say more, but it could not say it about *this*
 * photo: a guest who has shot three in a row reads the chips and still has to
 * work out which is which. An icon over the picture has no such problem, and
 * needs no words in either language. It is also the reason the mark disappears
 * on `confirmed` — a photo that is in the album is just a photograph, and
 * anything left on top of it would be the fourth thing on this screen saying
 * so.
 */
function DevelopingCell({
  pending,
  offline,
}: {
  pending: PendingFrame
  offline: boolean
}) {
  const { previewUrl, progress, confirmed, receipt, durable } = pending
  // Losing signal outranks whatever the upload last reported: the bytes are
  // not moving, and if they are safe on the phone that is the one reassuring
  // thing left to say.
  const state: CaptureReceiptState =
    offline && !confirmed && receipt !== 'lost' ? 'waiting' : receipt
  const mark = receiptMark(state, durable)

  return (
    <motion.span
      className="relative size-13 shrink-0 snap-start overflow-hidden rounded-xs bg-white/8"
      initial={false}
      animate={{ opacity: offline && !confirmed ? 0.45 : 1 }}
      transition={T.settle}
    >
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
        {mark ? (
          <motion.span
            key={mark.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={T.settle}
            className="absolute inset-0 flex items-center justify-center bg-black/35"
          >
            <mark.Icon
              className={`size-4 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] ${mark.tone}`}
              strokeWidth={2}
              aria-hidden="true"
            />
          </motion.span>
        ) : null}
      </AnimatePresence>

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
    </motion.span>
  )
}

/**
 * The same news the marks carry, in a sentence.
 *
 * Only the two states a guest could act on are named. "Uploading" is not one
 * of them — it resolves by itself and saying so on every frame would bury the
 * one line that matters, which is that a photo is being held by this page
 * alone.
 */
function pendingSummary(
  pending: PendingFrame[],
  offline: boolean,
  locale: Locale,
): string {
  const en = locale === 'en'
  const live = pending.filter((p) => !p.confirmed && p.receipt !== 'lost')
  const held = live.filter((p) => !p.durable).length
  const waiting = offline ? live.filter((p) => p.durable).length : 0

  if (held > 0) {
    return en
      ? `${held} ${held === 1 ? 'photo is' : 'photos are'} held by this page only. Keep it open until they upload.`
      : `${held} kép csak ezen az oldalon van meg. Tartsd nyitva, amíg fel nem töltődnek.`
  }
  if (waiting > 0) {
    return en
      ? `${waiting} ${waiting === 1 ? 'photo is' : 'photos are'} saved on this phone and waiting for signal.`
      : `${waiting} kép el van mentve a telefonon, és kapcsolatra vár.`
  }
  return ''
}

/**
 * The one icon that goes over a developing frame, or null for none.
 *
 * Null is the whole point of the `confirmed` case: the mark is there to answer
 * "is this photo safe", and once it is in the album the answer is the picture.
 *
 * `waiting` splits on `durable` because the two are opposite instructions. A
 * shot already in IndexedDB is merely waiting for signal and the guest may put
 * the phone away; one that is not is being held by this tab alone, and closing
 * the page loses it.
 */
function receiptMark(
  state: CaptureReceiptState,
  durable: boolean,
): { key: string; tone: string; Icon: typeof CloudUpload } | null {
  switch (state) {
    case 'confirmed':
      return null
    case 'saving':
      return { key: 'saving', tone: 'text-white/85', Icon: Smartphone }
    case 'stored':
      return { key: 'stored', tone: 'text-white/85', Icon: ShieldCheck }
    case 'uploading':
      return { key: 'uploading', tone: 'text-accent', Icon: CloudUpload }
    case 'waiting':
      return durable
        ? { key: 'waiting', tone: 'text-warning', Icon: WifiOff }
        : { key: 'held', tone: 'text-warning', Icon: TriangleAlert }
    case 'memory_only':
      return { key: 'held', tone: 'text-warning', Icon: TriangleAlert }
    case 'lost':
      return { key: 'lost', tone: 'text-destructive', Icon: TriangleAlert }
  }
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
