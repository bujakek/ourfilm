'use client'

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Clock,
  Download,
  ExternalLink,
  EyeOff,
  Hourglass,
  Settings,
  Share2,
} from 'lucide-react'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import type { ReactNode } from 'react'

import type { Locale } from '@/lib/i18n'
import { EXAMPLE_SLUG_SUFFIX, slugify } from '@/lib/slug'
import { eventUrl } from '@/lib/site'

/**
 * Three real product screens, drawn at phone size.
 *
 * The step section used to be three photographs of a wedding and a caption
 * each — pictures of the *occasion*, which a visitor can already imagine, and
 * nothing at all of the thing being sold. These are the screens they will
 * actually get: the third create-flow question, the host's console, and the
 * guest's roll.
 *
 * **They are depictions, not the components.** `OnboardingShell` is
 * `h-[100dvh]` and takes navigation callbacks; `GuestEventView` owns an upload
 * pipeline. Neither survives being dropped into a 252px box, and importing
 * host and guest components into a marketing page would tie the landing page's
 * layout to the product's internals. So the markup is reproduced here —
 * element for element, against a screenshot of each shipped screen at 390px,
 * which is the only way a mock stays a mock rather than becoming a picture of
 * a screen nobody will be shown.
 *
 * **Only the type scale is not literal.** Content is 212px wide here against
 * 350px on a phone, so a linear 0.6 would put every mono label at 6px — a grey
 * smudge, which is a *less* faithful depiction of a legible label than a
 * slightly large one. Display sizes are scaled; labels bottom out around 7px.
 * Everything else — order, materials, radii, rules, colour — is what ships.
 *
 * Two places the earlier drawing simplified and this one does not, because the
 * whole argument for the section is that a visitor sees the real thing:
 *
 * - The guest's roll is the film strip, with perforations, 30px cells and the
 *   exposed/unexposed boundary. It was a row of dashes, on the grounds that
 *   the real strip would only show four frames at this width. It shows six,
 *   and the boundary is exactly what it is there for.
 * - The reveal question's two answers are the product's side-by-side cards
 *   with an icon, a title and a line of explanation, not radio rows.
 */

/** The hardware. Arbitrary radii on purpose: this is a picture of a phone, not
 *  a product surface, so it is not on the radius scale. */
export function PhoneMock({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="w-[252px] shrink-0 rounded-[30px] border border-white/10 bg-[#16161a] p-2 shadow-[0_40px_80px_-34px_rgba(0,0,0,0.95)]"
    >
      <div className="flex h-[568px] flex-col overflow-hidden rounded-[23px] bg-background px-5 pt-6.5 pb-5">
        {children}
      </div>
    </div>
  )
}

const MONO_LABEL = 'font-mono font-medium tracking-[0.14em]'
const NAME = 'Anna & Péter'

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

  return (
    <PhoneMock>
      {/* `onboarding-shell.tsx`: back button left, the count right. It is not
          centred — the header is a row with two ends. */}
      <div className="flex items-center justify-between">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/15">
          <ArrowLeft className="size-[14px]" />
        </span>
        <span
          className={`flex items-center ${MONO_LABEL} text-[8px] text-foreground/40`}
        >
          03<span className="px-0.5">/</span>04
        </span>
      </div>

      <p
        className={`mt-4 ${MONO_LABEL} text-[7.5px] tracking-[0.2em] text-accent`}
      >
        {en ? 'DEVELOPING' : 'AZ ELŐHÍVÁS'}
      </p>
      <p className="mt-2 font-display text-[23px] leading-[1.04] tracking-[-0.01em] text-balance">
        {en
          ? 'When should the photos appear?'
          : 'Mikor jelenjenek meg a képek?'}
      </p>
      <p className="mt-2 text-[10.5px] leading-[1.5] text-pretty text-muted-foreground">
        {en
          ? 'Keep them hidden while everyone shoots, or reveal them as they arrive. You decide.'
          : 'Maradjanak rejtve, amíg mindenki fotózik, vagy jelenjenek meg azonnal. Te döntöd el.'}
      </p>

      {/* `reveal-preview.tsx`: two portrait cards, each blurred behind its own
          guest's name, and one badge lying across the gap between them. The
          badge is what makes the pair a *state* rather than two dark photos. */}
      {/* `flex-1` with a ceiling, exactly as `reveal-preview.tsx` has it: the
          pair grows into whatever the question leaves it. Fixed-aspect cards
          left a third of the screen empty, which is not a layout this step
          has at any phone size. */}
      <div className="relative mt-3.5 grid max-h-[168px] min-h-0 flex-1 grid-cols-2 gap-1.5">
        {[
          { src: '/images/guests-laughing.webp', name: 'Nóra' },
          { src: '/images/evening-party.webp', name: 'Bence' },
        ].map((guest) => (
          <span
            key={guest.name}
            className="relative block h-full overflow-hidden rounded-[13px] border border-border"
          >
            <Image
              src={guest.src}
              alt=""
              fill
              sizes="102px"
              className="scale-105 object-cover blur-[8px]"
            />
            <span className="absolute top-2 left-2 text-[10px] font-medium text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.95)]">
              {guest.name}
            </span>
          </span>
        ))}
        <span
          className={`pointer-events-none absolute inset-x-0 top-1/2 mx-auto flex w-fit max-w-full -translate-y-1/2 items-center gap-1.5 rounded-full border border-border-strong bg-background/80 px-2.5 py-1.5 text-center ${MONO_LABEL} text-[7px] leading-[1.5] tracking-[0.08em] text-balance`}
        >
          <Clock className="size-2.5 shrink-0" />
          {en ? 'OPENS · 3 SEPT, 20:00' : 'MEGNYÍLIK · SZEPT. 3. 20:00'}
        </span>
      </div>

      {/* `reveal-selector.tsx`: two cards, not two radio rows. The selected one
          is a lilac ring over a lilac wash — the film is live in it. */}
      <div className="mt-5 grid grid-cols-2 gap-1.5">
        {[
          {
            Icon: Hourglass,
            label: en ? 'Right away' : 'Azonnal',
            detail: en
              ? 'Photos appear while the event is happening.'
              : 'A képek már az esemény alatt megjelennek.',
            active: false,
          },
          {
            Icon: Clock,
            label: en ? 'When the event ends' : 'Az esemény végén',
            detail: en
              ? 'The gallery opens when shooting ends.'
              : 'A galéria a fotózás végén nyílik meg.',
            active: true,
          },
        ].map(({ Icon, label, detail, active }) => (
          <span
            key={label}
            className={`relative flex min-h-[74px] flex-col justify-between overflow-hidden rounded-[10px] border p-2.5 ${
              active ? 'border-transparent' : 'border-border'
            }`}
          >
            {active ? (
              <span className="absolute inset-0 rounded-[10px] bg-accent/10 ring-2 ring-accent ring-inset" />
            ) : null}
            <Icon
              className={`relative z-10 size-3.5 ${active ? 'text-accent' : 'text-foreground/70'}`}
            />
            <span className="relative z-10">
              <span
                className={`block text-[10.5px] leading-snug font-semibold text-balance ${
                  active ? 'text-accent' : ''
                }`}
              >
                {label}
              </span>
              <span
                className={`mt-0.5 block text-[8px] leading-[1.4] ${
                  active ? 'text-accent/70' : 'text-muted-foreground'
                }`}
              >
                {detail}
              </span>
            </span>
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <span className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/10">
          <span className="block h-full w-3/4 bg-accent" />
        </span>
        <span className="paper inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-[12px] px-4 text-[12.5px] font-semibold">
          {en ? 'Continue' : 'Tovább'}
          <ArrowRight className="size-3.5" />
        </span>
      </div>
    </PhoneMock>
  )
}

/** Step 02 — the host console at `/host/events/[slug]`. */
export function ScreenTicket({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const url = eventUrl(`${slugify(NAME)}-${EXAMPLE_SLUG_SUFFIX}`, locale)

  const figures: [string, string][] = [
    ['84', en ? 'PHOTOS TAKEN' : 'KÉP KÉSZÜLT'],
    ['12', en ? 'GUESTS' : 'VENDÉG'],
    ['24', en ? 'SHOTS EACH' : 'KÉP FEJENKÉNT'],
  ]

  // Everything in this row is `whitespace-nowrap`: on a phone it is one line,
  // and a wrapped "Guest / view" would be a layout this screen never has.
  const pill =
    'inline-flex shrink-0 items-center gap-1 rounded-full border border-white/14 px-1.5 py-0.5 text-[7px] font-medium whitespace-nowrap text-foreground/80'

  return (
    <PhoneMock>
      {/* The console's own top bar — a way back and the two places a host goes
          from here. The mock used to open with a bare "OURFILM", which is the
          guest's header, on the host's screen. */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[7px] tracking-[0.1em] whitespace-nowrap text-foreground/45">
          <ArrowLeft className="size-2" />
          {en ? 'YOUR EVENTS' : 'ESEMÉNYEID'}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className={pill}>
            <ExternalLink className="size-2" />
            {en ? 'Guest view' : 'Vendégnézet'}
          </span>
          <span className={pill}>
            <Settings className="size-2" />
            {en ? 'Settings' : 'Beállítások'}
          </span>
        </span>
      </div>

      <span
        className={`mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/35 px-2.5 py-1 ${MONO_LABEL} text-[7px] tracking-[0.16em] text-accent`}
      >
        <span className="size-[4px] rounded-full bg-accent" />
        {en ? 'CAMERA OPEN · 6H 20M' : 'A KAMERA NYITVA · 6Ó 20P'}
      </span>

      <p className="mt-2.5 font-display text-[26px] leading-none tracking-[-0.012em]">
        {NAME}
      </p>

      {/* Ruled top *and* bottom, and divided by uprights — the console's figure
          row is a table rule, not three floating columns. */}
      <div className="mt-4 grid grid-cols-3 border-y border-border">
        {figures.map(([value, label], i) => (
          <span
            key={label}
            className={`py-2.5 ${i > 0 ? 'border-l border-border px-3' : 'pr-3'}`}
          >
            <span className="block font-mono text-[19px] leading-none font-medium tracking-[-0.05em]">
              {value}
            </span>
            <span
              className={`mt-1 block ${MONO_LABEL} text-[6.5px] tracking-[0.16em] text-foreground/45`}
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="paper mt-3.5 rounded-xs p-3 text-center">
        <p className="font-display text-[16px] leading-[1.1]">{NAME}</p>
        <p
          className={`paper-muted mt-1 ${MONO_LABEL} text-[6.5px] tracking-[0.2em]`}
        >
          {en ? 'DISPOSABLE CAMERA · 24 SHOTS' : 'ELDOBHATÓ KAMERA · 24 KÉP'}
        </p>
        <span className="mx-auto mt-2.5 block w-fit bg-white p-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
          <QRCodeSVG
            value={url}
            size={70}
            level="M"
            bgColor="#ffffff"
            fgColor="#050505"
            marginSize={0}
          />
        </span>
        {/* Wrapping, not truncating — the same decision the real ticket makes,
            because this address is what a guest types when a code will not
            scan. */}
        <p className="paper-muted mt-2 font-mono text-[7.5px] leading-[1.35] font-medium break-all">
          {url.replace('https://', '')}
        </p>
        <div className="paper-rule mt-2.5 flex gap-1.5 border-t pt-2.5">
          <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] bg-[color:var(--paper-foreground)] py-2 text-[9.5px] font-semibold text-[color:var(--paper)]">
            <Download className="size-2.5" />
            {en ? 'Download' : 'Letöltés'}
          </span>
          <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-[9px] border border-[rgba(20,19,18,.2)] py-2 text-[9.5px] font-semibold">
            <Share2 className="size-2.5" />
            {en ? 'Share' : 'Megosztás'}
          </span>
        </div>
      </div>

      {/* `moderation-grid.tsx` — two across on a phone, every tile credited to
          the guest who shot it and carrying the one control a host needs. The
          mock had four unlabelled squares, which is a gallery; this is the
          screen where a host hides a photo. */}
      <div className="mt-3 border-t border-border pt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-[14px] leading-none">
            {en ? 'Photos' : 'Elkészült képek'}
          </span>
          <span
            className={`ml-auto font-mono text-[7px] tracking-[0.1em] text-foreground/45`}
          >
            84 {en ? 'PHOTOS' : 'KÉP'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/14 px-2 py-1 text-[8px] font-medium text-foreground/80">
            <Download className="size-2.5" />
            Album
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {[
            ['reveal-bride-friends', 'NÓRA'],
            ['reveal-celebration', 'BENCE'],
          ].map(([photo, who]) => (
            <span
              key={photo}
              className="relative block aspect-square overflow-hidden rounded-sm"
            >
              <Image
                src={`/images/landing/${photo}.webp`}
                alt=""
                fill
                sizes="102px"
                className="object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-5 pb-1">
                <span className="truncate font-mono text-[7px] tracking-[0.06em] text-white/85">
                  {who}
                </span>
                <EyeOff className="size-2.5 shrink-0 text-white/70" />
              </span>
            </span>
          ))}
        </div>
      </div>

      <span className="flex-1" />
    </PhoneMock>
  )
}

/** Step 03 — the guest screen at `/e/[slug]`: counter, roll, shutter. */
export function ScreenCamera({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const exposed = 7
  const total = 24
  // The real strip parks the exposed/unexposed boundary against the right
  // edge, so what a guest sees is the last frames they shot and the first
  // blank. Six whole cells is what 212px holds — the same six the phone holds
  // at 350px, which is why they are 27px here and 52px there. Six, not seven:
  // a strip clipped mid-cell reads as a rendering fault rather than a scroll.
  const roll = ['how-guest-photo', 'reveal-limbo', 'how-couple', 'final-rings']

  return (
    <PhoneMock>
      <div className="flex items-center justify-between">
        <span
          className={`${MONO_LABEL} text-[7.5px] tracking-[0.18em] text-foreground/40`}
        >
          OURFILM
        </span>
        <span
          className={`inline-flex items-center gap-1.5 ${MONO_LABEL} text-[7.5px] text-accent`}
        >
          <span className="size-[4px] rounded-full bg-accent" />
          {en ? 'LIVE · 6H 20M' : 'NYITVA · 6Ó 20P'}
        </span>
      </div>

      <p className="mt-2.5 font-display text-[23px] leading-[1.02] tracking-[-0.005em]">
        {NAME}
      </p>

      <div className="mt-4 flex items-end gap-2">
        <span className="font-mono text-[42px] leading-[0.82] font-medium tracking-[-0.06em]">
          {total - exposed}
        </span>
        <span className="pb-1 font-mono text-[13px] tracking-[-0.03em] text-foreground/35">
          /{total}
        </span>
        <span
          className={`ml-auto pb-1 text-right ${MONO_LABEL} text-[7px] leading-[1.5] text-foreground/50`}
        >
          {en ? (
            <>
              FRAMES
              <br />
              REMAINING
            </>
          ) : (
            <>
              MARADT
              <br />
              KÉPKOCKA
            </>
          )}
        </span>
      </div>

      {/* `film-strip.tsx`, at 30px cells. Perforations top and bottom on a
          pitch that divides a frame exactly, exposed cells holding this
          guest's own photos, the rest numbered blanks — and the boundary
          between them, which is the whole reason the element exists. */}
      <div className="film mt-3.5 overflow-hidden rounded-xs py-1">
        <Perfs />
        <div className="flex gap-[3px] px-1.5 py-1">
          {roll.map((photo) => (
            <span
              key={photo}
              className="relative size-[27px] shrink-0 overflow-hidden rounded-[3px] bg-white/8"
            >
              <Image
                src={`/images/landing/${photo}.webp`}
                alt=""
                fill
                sizes="27px"
                className="object-cover"
              />
            </span>
          ))}
          {[exposed + 1, exposed + 2].map((frame) => (
            <span
              key={frame}
              className="flex size-[27px] shrink-0 items-end justify-end rounded-[3px] border border-white/10 p-[2px] font-mono text-[6px] text-white/20"
            >
              {String(frame).padStart(2, '0')}
            </span>
          ))}
        </div>
        <Perfs />
      </div>

      {/* The shutter sits directly under the roll it spends, above the gallery
          — not pinned to the bottom of the screen. */}
      <div className="mt-3.5 flex items-center gap-2">
        <span className="paper inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[13px] text-[12.5px] font-semibold">
          <Camera className="size-3.5" strokeWidth={1.8} />
          {en ? 'Camera' : 'Kamera'}
        </span>
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[13px] border border-white/14 text-foreground/75">
          <Share2 className="size-3.5" strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-2.5 text-center font-mono text-[7px] tracking-[0.02em] text-foreground/35">
        {en
          ? '7 GUESTS · NO PREVIEW · NO RETAKES'
          : '7 VENDÉG · NINCS ELŐNÉZET · NINCS ÚJRAPRÓBÁLÁS'}
      </p>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[15px] leading-none">
            {en ? 'Shared photos' : 'Közös képek'}
          </span>
          <span className="font-mono text-[7px] tracking-[0.1em] text-foreground/40">
            42 {en ? 'PHOTOS' : 'KÉP'}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1">
          {[
            'reveal-celebration',
            'hero-dance-crowd',
            'hero-sunglasses-couple',
            'final-couple-table',
            'hero-bride-party',
            'final-dance-circle',
            'hero-couple-dance',
            'reveal-couple-toast',
            'hero-bride-portrait',
          ].map((photo) => (
            <span
              key={photo}
              className="relative block aspect-square overflow-hidden rounded-sm"
            >
              <Image
                src={`/images/landing/${photo}.webp`}
                alt=""
                fill
                sizes="68px"
                className="object-cover"
              />
            </span>
          ))}
        </div>
      </div>
    </PhoneMock>
  )
}

/** One perforation row. 5px on a 4px gap, so four of them span a 30px cell. */
function Perfs() {
  return (
    <div className="flex gap-1 px-1.5">
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className="film-perf h-[4px] w-[5px] shrink-0 rounded-[1.5px]"
        />
      ))}
    </div>
  )
}
