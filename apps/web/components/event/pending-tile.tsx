'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { developingWash } from '@/lib/developing-wash'
import type { Locale } from '@/lib/i18n'
import { T, still } from '@/lib/motion'

/**
 * Where a shot has got to, from the shutter to the album.
 *
 * `saving` and `stored` are about this phone; `uploading` and `confirmed` are
 * about the server; `memory_only` is the one that matters most — IndexedDB
 * refused, so the tab is the photo's only home and closing it loses the
 * picture.
 */
export type CaptureReceiptState =
  | 'saving'
  | 'stored'
  | 'uploading'
  | 'waiting'
  | 'confirmed'
  | 'memory_only'
  | 'lost'

/**
 * A frame that has been claimed but not yet confirmed.
 *
 * There can be more than one: the shutter does not wait for an upload to
 * finish, so a guest shooting a toast on venue wifi may have two or three
 * tiles developing at once.
 *
 * `previewUrl` is an object URL for the file the OS camera just handed over —
 * the only copy of the photo that exists on this device until it lands.
 */
export type PendingFrame = {
  previewUrl: string
  /** 0–1, the fraction of the shot's bytes that have reached Storage. */
  progress: number
  /** True only once `commit_shot` has returned. */
  confirmed: boolean
  receipt: CaptureReceiptState
  /** Whether IndexedDB has acknowledged a copy that outlives this tab. */
  durable: boolean
  /**
   * The locked wall's seed for this photo (`lib/tile-seed.ts`), once
   * `reserve_shot` has named it. Null before then.
   */
  seed: number | null
}

/** The ring's radius in a 28px box. */
const RING_R = 11

/**
 * A shot on its way to the album, drawn as the newest tile of the shared grid
 * (guest view `11b`, `11c`).
 *
 * Upload state is shown on the photo and nowhere else: the picture develops
 * from grayscale and blur as bytes land, and a determinate ring over it fills
 * with `progress`. Offline, the tile dims and the ring turns amber at whatever
 * fill it had reached; the words for that state are the page's banner.
 *
 * How it ends depends on whether the album is open, because a sharp photo
 * before the reveal is a preview and the format has none:
 *
 * - **Locked.** The photo never resolves past a heavy blur. On the server's
 *   200 it sinks into the same wash the locked wall draws for it — the seed is
 *   the one the database will send. The caller holds the tile until the wash
 *   has settled before refreshing, so the wall tile that replaces it is the
 *   same colour in the same place and nothing visibly changes.
 * - **Open.** It snaps clear on the 200 and wears the white confirmation edge
 *   until the real thumbnail takes its place.
 */
export function PendingTile({
  pending,
  offline,
  locked,
}: {
  pending: PendingFrame
  offline: boolean
  /** Whether the shared album is still waiting for its reveal. */
  locked: boolean
}) {
  const reduceMotion = useReducedMotion()
  const { previewUrl, progress, confirmed, seed } = pending
  const stalled = offline && !confirmed
  const p = Math.max(0, Math.min(1, progress))
  const filter = locked
    ? `grayscale(1) blur(${6 - 2 * p}px)`
    : confirmed
      ? 'grayscale(0) blur(0px)'
      : `grayscale(${1 - 0.6 * p}) blur(${6 - 4.6 * p}px)`

  return (
    <motion.li
      aria-hidden="true"
      className="relative aspect-square overflow-hidden rounded-[12px] bg-film"
      initial={false}
      animate={{ opacity: stalled ? 0.55 : 1 }}
      transition={T.settle}
    >
      <motion.span
        className="absolute inset-0 block"
        initial={{ filter: 'grayscale(1) blur(6px)' }}
        animate={{ filter }}
        transition={confirmed && !locked ? T.settle : T.develop}
      >
        {/* A local object URL, so `next/image` has nothing to optimise and no
            dimensions to reason about. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" className="size-full object-cover" />
      </motion.span>

      <AnimatePresence>
        {confirmed && locked ? (
          <motion.span
            key="sealed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion ? still : T.develop}
            className="absolute inset-0"
          >
            {/* Drawn exactly as `DevelopingGallery` draws the tile, oversized
                under the blur for the same reason. */}
            <span
              className="absolute -inset-3 blur-lg"
              style={{ background: developingWash(seed ?? 0) }}
            />
          </motion.span>
        ) : confirmed ? (
          <motion.span
            key="confirmed"
            initial={{ opacity: 0, scale: 1.14 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={T.settle}
            className="absolute inset-0 rounded-[12px] ring-[1.5px] ring-white ring-inset"
          />
        ) : (
          <motion.span
            key="ring"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={T.settle}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle
                cx="14"
                cy="14"
                r={RING_R}
                stroke="rgba(255,255,255,.25)"
              />
              {/* Determinate, never a loop: the arc only moves because more
                  bytes arrived. `pathLength` is motion's own dash, so the fill
                  is on a named curve rather than a CSS literal. */}
              <motion.circle
                cx="14"
                cy="14"
                r={RING_R}
                transform="rotate(-90 14 14)"
                className={stalled ? 'stroke-host-warn' : 'stroke-landing-sky'}
                initial={false}
                animate={{ pathLength: p }}
                transition={reduceMotion ? still : T.advance}
              />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/**
 * The tiles' news in a sentence, for screen readers — the tiles themselves are
 * `aria-hidden`. Only the two states a guest could act on are named.
 * "Uploading" resolves by itself; saying so every frame would bury the line
 * that matters.
 */
export function pendingSummary(
  pending: PendingFrame[],
  offline: boolean,
  locale: Locale,
): string {
  const en = locale === 'en'
  const live = pending.filter((p) => !p.confirmed && p.receipt !== 'lost')
  const held = live.filter((p) => isHeldInMemory(p)).length
  const waiting = offline ? live.filter((p) => p.durable).length : 0

  if (held > 0) {
    return en
      ? `${held} ${held === 1 ? 'photo is' : 'photos are'} held by this page only. Keep it open until they upload.`
      : `${held} kép csak ezen az oldalon van meg. Tartsd nyitva, amíg fel nem töltődnek.`
  }
  if (waiting > 0) {
    return en
      ? `${waiting} ${waiting === 1 ? 'photo is' : 'photos are'} saved on this phone and waiting for signal.`
      : `${waiting} kép el van mentve a telefonon, és térerőre vár.`
  }
  return ''
}

/**
 * IndexedDB has answered and refused. `saving` is excluded: that is the
 * second or two before the store has answered at all, and a warning that
 * flashes on every shutter press is not a warning.
 */
export function isHeldInMemory(p: PendingFrame): boolean {
  return (
    !p.confirmed && p.receipt !== 'lost' && !p.durable && p.receipt !== 'saving'
  )
}
