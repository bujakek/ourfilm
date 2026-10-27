'use client'

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Eye,
  QrCode,
  Settings,
  Share2,
  Wifi,
} from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'

import type { Locale } from '@/lib/i18n'
import { DEFAULT_SHOTS } from '@/lib/camera'
import { FREE_PARTICIPANT_LIMIT } from '@/lib/onboarding'

/** The guests in the mocked event, on the console and on the guest's roll
 *  alike. One under the free cap, so the mock shows a free event with room
 *  left rather than one at its limit. */
const MOCK_GUESTS = FREE_PARTICIPANT_LIMIT - 1

/**
 * Three real product screens, drawn at phone size: the reveal question of the
 * create flow, the host's event page, and the guest's camera.
 *
 * **They are depictions, not the components.** `OnboardingShell` is
 * `h-[100dvh]` and takes navigation callbacks; `GuestEventView` owns an upload
 * pipeline. Neither survives being dropped into a 254px box, and importing
 * host and guest components into a marketing page would tie the landing page's
 * layout to the product's internals. So the markup is drawn here, from the
 * approved phone design (`OurFilm Phone` in the v5 handoff), in the same
 * landing look the product screens wear: white washes on the `#0d0d0d`
 * ground, Roboto Serif names, Crimson figures, Inter kickers, one white
 * button, and sky only for what is live or chosen.
 *
 * **Only the type scale is not literal.** Content is 226px wide here against
 * 350px on a phone, so kickers bottom out around 6px rather than shrinking
 * linearly into a grey smudge.
 */

/**
 * The hardware: a titanium rim, a black bezel, and the screen.
 *
 * It was a `#16161a` box with a 30px radius — a rectangle standing in for a
 * phone, which is fine right up until the thing inside it is a faithful
 * product screen. Then the frame is the only unconvincing part of the picture,
 * and a mock is only worth drawing if a visitor reads it as a phone before
 * they read it as a diagram.
 *
 * Three layers, because a real edge is three: a 2px rim carrying a gradient
 * that runs light–dark–light–dark–light across 155°, which is how brushed
 * titanium catches a room; a `#07070a` bezel inside it; then the screen.
 * Nested radii descend 47 → 45 → 38 so the curves stay concentric rather than
 * pinching at the corners.
 *
 * **The screen grew 568 → 648.** The island and the home indicator each need
 * clearance the old frame never reserved, and `pt-[50px]` / `pb-6.5` are that
 * clearance. Without it `ScreenTicket` overflowed by 22px and its moderation
 * tiles were sliced by the bezel rather than by the fold. Every screen keeps a
 * trailing `flex-1` spacer for the same reason: the indicator has to sit on
 * empty screen, never on top of a photograph.
 */
export function PhoneMock({
  children,
  fade = false,
}: {
  children: ReactNode
  /** True when this screen's content runs past the bottom of the screen. */
  fade?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      className="w-[254px] shrink-0 rounded-[47px] p-[2px] shadow-[0_40px_80px_-34px_rgba(0,0,0,0.95)]"
      style={{
        backgroundImage:
          'linear-gradient(155deg,#7b7b87,#26262c 26%,#9a9aa6 50%,#22222a 74%,#63636e)',
      }}
    >
      <div className="rounded-[45px] bg-[#07070a] p-[7px]">
        {/* Block flow, emphatically not a flex column. As a fixed-height flex
            column every child becomes shrinkable, and the first thing to go is
            the film strip: its cells have no intrinsic height to defend, so it
            collapses to a smear. In block flow the content keeps its own
            height and the screen simply clips what does not fit. */}
        <div className="relative h-[510px] overflow-hidden rounded-[38px] bg-landing px-3.5 pt-[48px]">
          {children}
          {fade ? <BottomFade /> : null}
          <StatusBar />
          <DynamicIsland />
        </div>
      </div>
    </div>
  )
}

/**
 * The bottom of a screenshot of a screen that scrolls.
 *
 * These are phones mid-scroll, not screens that happen to end. Cropping at a
 * hard edge reads as a layout that ran out of room; a fade reads as the rest
 * of the page continuing below, which is what is actually true of every one
 * of these screens on a real device.
 *
 * Painted only where the content really does overflow. `ScreenReveal` fills
 * its screen exactly and gets none — a fade there would dim its own Continue
 * button, which is the one thing on that screen a visitor has to read.
 */
function BottomFade() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[52px]"
      style={{
        backgroundImage: 'linear-gradient(180deg,transparent,#0d0d0d 72%)',
      }}
    />
  )
}

/**
 * 9:41, signal, wifi, battery.
 *
 * `px-4.5`, not the 24px a full-size iOS inset would be. The island is 32% of
 * the screen's width here exactly as it is on the device, but the icons are
 * held near full size for legibility — the same trade the type scale makes —
 * so the right cluster is proportionally wider than iOS's and a 24px inset
 * pushed its first cellular bar under the island. 18px on a 236px screen is
 * 7.6%, which is nearer iOS's true 7.1% than 24px was anyway.
 */
function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4.5 pt-4.5">
      <span className="text-[12px] font-semibold tracking-[-0.01em]">9:41</span>
      <span className="flex items-center gap-[4px]">
        <span className="flex items-end gap-[1.5px]">
          {['h-[4px]', 'h-[6px]', 'h-[8px]', 'h-[10px]'].map((h) => (
            <span key={h} className={`w-[2.5px] rounded-[1px] bg-white ${h}`} />
          ))}
        </span>
        <Wifi className="size-[13px]" strokeWidth={2.2} />
        {/* 72%: a phone someone has been using all day, which is the phone
            this product is held on. */}
        <span className="relative flex h-[11px] w-[21px] items-center rounded-[3px] border border-white/45 p-[1.5px]">
          <span className="h-full w-[72%] rounded-[1.5px] bg-white" />
          <span className="absolute -right-[3px] h-[4px] w-[1.5px] rounded-r-[1px] bg-white/45" />
        </span>
      </span>
    </div>
  )
}

/** The island, with the lens ringed the way glass rings under a black mask. */
function DynamicIsland() {
  return (
    <span className="absolute top-[11px] left-1/2 z-20 flex h-[24px] w-[76px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[7px]">
      <span className="size-[8px] rounded-full bg-[#0b0e14] ring-[1.5px] ring-[rgba(130,150,190,0.4)] ring-inset" />
    </span>
  )
}

const NAME = 'Anna & Péter'

/** A kicker at phone scale: Inter 500, tracked capitals. */
const KICKER =
  'text-[6px] leading-[1.3] font-medium tracking-[0.24em] uppercase'

/** A name or a question in the display serif. */
const SERIF = 'landing-serif font-landing-display'

/**
 * The phone mocks draw photos at 68–216 CSS px, so they use a pre-resized copy
 * (`public/images/phone/`, 480px wide) served as a plain static file. Going
 * through `next/image` meant a Vercel optimizer request per tile, which is
 * metered, and which answered 400 for some of the widths the phones asked for.
 * Regenerate a thumb with `cwebp -q 80 -resize 480 0 <src> -o <dest>`.
 */
const phoneThumb = (src: string) => `/images/phone/${src.split('/').pop()}`

/**
 * Who the screen belongs to and what is on its roll. The defaults are the
 * wedding every mock has always shown; the homepage's occasion tabs pass a
 * birthday, a trip or a party instead, and nothing else about the screen
 * changes — it is the same product whatever the event.
 */
export interface ScreenContent {
  name?: string
  /** Public image paths, cycled through every photo slot on the screen. */
  photos?: readonly string[]
}

function pick(
  photos: readonly string[] | undefined,
  fallback: readonly string[],
): readonly string[] {
  if (!photos?.length) return fallback
  return fallback.map((_, i) => photos[i % photos.length])
}

const landingPhoto = (name: string) => `/images/landing/${name}.webp`

/** A 3-across grid of photos inside a panel, under a serif heading and a
 *  Crimson count: the host's photos and the guest's shared album alike. */
function PhotoPanel({
  title,
  count,
  photos,
}: {
  title: string
  count: number
  photos: readonly string[]
}) {
  return (
    <div className="mt-3 rounded-[18px] bg-white/4 px-2 pt-3 pb-2">
      <div className="flex items-baseline justify-between px-1">
        <span className={`${SERIF} text-[13px] leading-[1.2]`}>{title}</span>
        <span className="host-figure text-[13px] text-white/60">{count}</span>
      </div>
      <div className="mt-[9px] grid grid-cols-3 gap-[3px]">
        {photos.map((photo, i) => (
          <span
            key={i}
            className="relative block aspect-square overflow-hidden rounded-[7px]"
          >
            <Image
              src={phoneThumb(photo)}
              alt=""
              fill
              unoptimized
              className="object-cover"
            />
          </span>
        ))}
      </div>
    </div>
  )
}

/** A live kicker: the sky dot and the words, both sky. */
function LiveKicker({ children }: { children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${KICKER} text-landing-sky`}
    >
      <span className="size-[3px] rounded-full bg-landing-sky" />
      {children}
    </span>
  )
}

/**
 * Step 01 — question three of `/host/events/new`.
 *
 * The third question rather than the first because the reveal is the decision
 * the marketing copy beside it actually names: choosing when the photos appear
 * is the product's one idea, and "what is your event called" is every form
 * anyone has ever filled in.
 */
export function ScreenReveal({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const options = [
    {
      label: en ? 'Right away' : 'Azonnal',
      detail: en
        ? 'Photos appear during the event.'
        : 'A képek az esemény alatt megjelennek.',
      active: false,
    },
    {
      label: en ? 'When the event ends' : 'Az esemény végén',
      detail: en
        ? 'The gallery opens when shooting ends.'
        : 'A galéria a fotózás végén nyílik meg.',
      active: true,
    },
  ]

  return (
    <PhoneMock>
      <div className="flex items-center justify-between">
        <span className="flex size-[22px] items-center justify-center rounded-[7px] bg-white/6">
          <ArrowLeft className="size-[11px]" />
        </span>
        <span className="host-figure text-[13px] text-white/60">3 / 4</span>
      </div>

      <p className={`mt-3.5 ${KICKER} text-landing-sky`}>
        {en ? 'Developing' : 'Az előhívás'}
      </p>
      <p
        className={`mt-[7px] ${SERIF} text-[21px] leading-[1.15] text-balance`}
      >
        {en
          ? 'When should the photos appear?'
          : 'Mikor jelenjenek meg a képek?'}
      </p>

      {/* `reveal-preview.tsx`: two cards, each blurred behind its own guest's
          name, and one badge lying across the gap between them. */}
      <div className="relative mt-3.5 grid h-[112px] grid-cols-2 gap-1">
        {[
          { src: '/images/guests-laughing.webp', name: 'Nóra' },
          { src: '/images/evening-party.webp', name: 'Bence' },
        ].map((guest) => (
          <span
            key={guest.name}
            className="relative block h-full overflow-hidden rounded-[14px]"
          >
            <Image
              src={phoneThumb(guest.src)}
              alt=""
              fill
              unoptimized
              className="scale-105 object-cover blur-[8px]"
            />
            <span className="absolute top-2 left-[9px] text-[8px] font-medium drop-shadow-[0_1px_10px_rgba(0,0,0,0.95)]">
              {guest.name}
            </span>
          </span>
        ))}
        <span
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-landing/85 px-[9px] py-[5px] whitespace-nowrap ${KICKER} text-[5.5px] tracking-[0.2em]`}
        >
          {en ? 'Opens · 3 Sept, 20:00' : 'Megnyílik · szept. 3. 20:00'}
        </span>
      </div>

      {/* `reveal-selector.tsx`: two rows, the chosen one in sky. */}
      <div className="mt-3 flex flex-col gap-[5px]">
        {options.map(({ label, detail, active }) => (
          <span
            key={label}
            className={`flex min-h-10 items-center gap-2 rounded-[12px] px-[11px] py-1.5 ${
              active ? 'bg-landing-sky/12' : 'bg-white/4'
            }`}
          >
            <span
              className={`flex size-[9px] shrink-0 items-center justify-center rounded-full border-[1.2px] ${
                active ? 'border-landing-sky' : 'border-white/40'
              }`}
            >
              {active ? (
                <span className="size-1 rounded-full bg-landing-sky" />
              ) : null}
            </span>
            <span>
              <span
                className={`block text-[8.5px] leading-[1.4] font-medium ${
                  active ? 'text-landing-sky' : 'text-white'
                }`}
              >
                {label}
              </span>
              <span className="block text-[6.5px] leading-[1.4] text-white/55">
                {detail}
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/10">
          <span className="block h-full w-3/4 bg-landing-sky" />
        </span>
        <span className="inline-flex h-[30px] items-center gap-1 rounded-[9px] bg-white px-3 text-[9.5px] font-medium text-landing-ink">
          {en ? 'Continue' : 'Tovább'}
          <ArrowRight className="size-[10px]" />
        </span>
      </div>
    </PhoneMock>
  )
}

/** Step 02 — the host's event page at `/host/events/[slug]`. */
export function ScreenTicket({
  locale,
  name = NAME,
  photos,
}: { locale: Locale } & ScreenContent) {
  const en = locale === 'en'
  const tiles = pick(
    photos,
    [
      'reveal-celebration',
      'guests-laughing',
      'evening-party',
      'hero-dance-floor',
      'hero-couple-dance',
      'final-couple-table',
    ].map(landingPhoto),
  )

  const figures: [string, string][] = [
    ['84', en ? 'photos' : 'kép'],
    [String(MOCK_GUESTS), en ? 'guests' : 'vendég'],
    [String(DEFAULT_SHOTS), en ? 'each' : 'kép / fő'],
  ]

  // The event page's two icon buttons — guest view and settings. It has no
  // overflow menu, so the mock does not draw one.
  const iconTile =
    'flex size-5 items-center justify-center rounded-[7px] bg-white/6'

  return (
    <PhoneMock fade>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 ${KICKER} text-[6.5px] text-white/60`}
        >
          <ArrowLeft className="size-2" />
          {en ? 'Your events' : 'Eseményeid'}
        </span>
        <span className="flex gap-1">
          <span className={iconTile}>
            <Eye className="size-[9px]" />
          </span>
          <span className={iconTile}>
            <Settings className="size-[9px]" />
          </span>
        </span>
      </div>

      <p className="mt-2.5">
        <LiveKicker>
          {en ? 'Open · 6h 20m left' : 'Nyitva · még 6:20'}
        </LiveKicker>
      </p>
      <p className={`mt-1.5 ${SERIF} text-[21px] leading-[1.12]`}>{name}</p>

      <div className="mt-3 grid grid-cols-3 gap-1">
        {figures.map(([value, label]) => (
          <span
            key={label}
            className="flex flex-col rounded-[11px] bg-white/4 px-[7px] py-2"
          >
            <span className="host-figure text-[21px] leading-[1.05]">
              {value}
            </span>
            <span
              className={`mt-[3px] ${KICKER} text-[5.5px] tracking-[0.16em] text-white/50`}
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex gap-[5px]">
        <span className="flex h-[30px] flex-1 items-center justify-center rounded-[9px] bg-white text-[9.5px] font-medium text-landing-ink">
          {en ? 'Camera' : 'Kamera'}
        </span>
        <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-white/6">
          <QrCode className="size-3" strokeWidth={1.8} />
        </span>
      </div>

      <PhotoPanel title={en ? 'Photos' : 'Képek'} count={84} photos={tiles} />
    </PhoneMock>
  )
}

/** Step 03 — the guest screen at `/e/[slug]`: counter, shutter, album. */
export function ScreenCamera({
  locale,
  name = NAME,
  photos,
}: { locale: Locale } & ScreenContent) {
  const en = locale === 'en'
  const total = DEFAULT_SHOTS
  const left = 17
  const gallery = pick(
    photos,
    [
      'reveal-celebration',
      'hero-dance-crowd',
      'hero-sunglasses-couple',
      'final-couple-table',
      'hero-bride-party',
      'final-dance-circle',
      'hero-couple-dance',
      'reveal-couple-toast',
      'hero-bride-portrait',
    ].map(landingPhoto),
  )

  return (
    <PhoneMock fade>
      <div className="flex items-center justify-between">
        <span className={`${KICKER} text-[6.5px] text-white/50`}>OurFilm</span>
        <LiveKicker>{en ? 'Live · 6h 20m' : 'Nyitva · 6:20'}</LiveKicker>
      </div>

      <p className={`mt-2.5 ${SERIF} text-[21px] leading-[1.12]`}>{name}</p>

      <div className="mt-3 flex items-end gap-2 rounded-[16px] bg-white/4 px-3 pt-3 pb-2.5">
        <span className="host-figure text-[52px] leading-[0.85]">{left}</span>
        <span className="pb-[3px] font-landing-quote text-[20px] text-white/40 italic">
          /{total}
        </span>
        <span
          className={`ml-auto pb-1 text-right ${KICKER} text-[5.5px] leading-[1.5] tracking-[0.2em] text-white/50`}
        >
          {en ? 'Frames' : 'Maradt'}
          <br />
          {en ? 'remaining' : 'képkocka'}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-[5px]">
        <span className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-white text-[10.5px] font-medium text-landing-ink">
          <Camera className="size-3" strokeWidth={1.8} />
          {en ? 'Camera' : 'Kamera'}
        </span>
        <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-white/6">
          <Share2 className="size-3" strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-2 text-center text-[6.5px] text-white/45">
        {en
          ? `${MOCK_GUESTS} guests · no preview · no retakes`
          : `${MOCK_GUESTS} vendég · nincs előnézet · nincs újrapróbálás`}
      </p>

      <PhotoPanel
        title={en ? 'Shared photos' : 'Közös képek'}
        count={42}
        photos={gallery}
      />
    </PhoneMock>
  )
}
