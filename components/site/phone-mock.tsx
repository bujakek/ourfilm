'use client'

import { ArrowLeft, ArrowRight, Camera, Download, Share2 } from 'lucide-react'
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
 * actually get: the third create-flow question, the host's printable ticket,
 * and the guest's roll.
 *
 * **They are depictions, not the components.** `OnboardingShell` is
 * `h-[100dvh]` and takes navigation callbacks; `GuestEventView` owns an upload
 * pipeline. Neither survives being dropped into a 252px box, and importing
 * host and guest components into a marketing page would tie the landing page's
 * layout to the product's internals. So the markup is reproduced here and the
 * *strings* are the product's own, copied from the components named above —
 * which is what keeps a mock from drifting into a screen that does not exist.
 *
 * Two places where the prototype and the shipped product disagree, and the
 * product wins, because the whole argument for this section is that a visitor
 * sees the real thing:
 *
 * - Every numeral is Martian Mono, not the serif the prototype sets them in.
 *   "Mono for anything the camera counts" is the rule the rest of the product
 *   follows, and a serif counter here would be a picture of a screen nobody
 *   will ever be shown.
 * - The guest counter keeps its `/24` denominator. A bare `17` is not what the
 *   screen says, and the denominator is half of what makes it a roll.
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

/**
 * Step 01 — `step-reveal.tsx` inside `onboarding-shell.tsx`, at question three
 * of four.
 *
 * The third question rather than the first because the reveal is the decision
 * the marketing copy beside it actually names: choosing when the photos appear
 * is the product's one idea, and "what is your event called" is every form
 * anyone has ever filled in.
 */
export function ScreenReveal({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const blurred = [
    'reveal-bride-friends',
    'reveal-couple-toast',
    'final-couple-table',
    'reveal-celebration',
  ]

  return (
    <PhoneMock>
      <div className="flex items-center justify-between">
        <span className="flex size-[38px] items-center justify-center rounded-lg border border-white/15">
          <ArrowLeft className="size-4" />
        </span>
        <span className={`${MONO_LABEL} text-[10px] text-foreground/40`}>
          03 / 04
        </span>
        <span className="w-[38px]" />
      </div>

      <p
        className={`mt-5.5 ${MONO_LABEL} text-[9px] tracking-[0.2em] text-accent`}
      >
        {en ? 'DEVELOPING' : 'AZ ELŐHÍVÁS'}
      </p>
      <p className="mt-3 font-display text-[27px] leading-[1.06] tracking-[-0.01em] text-balance">
        {en
          ? 'When should the photos appear?'
          : 'Mikor jelenjenek meg a képek?'}
      </p>
      <p className="mt-2.5 text-[12.5px] leading-[1.55] text-pretty text-foreground/55">
        {en
          ? 'Keep them hidden while everyone shoots, or reveal them as they arrive.'
          : 'A képek alapból rejtve maradnak az esemény alatt. Te döntöd el, mikor nyíljon meg a galéria.'}
      </p>

      <div className="relative mt-4.5 aspect-video overflow-hidden rounded-sm">
        <span className="absolute inset-0 grid grid-cols-2 gap-[2px]">
          {blurred.map((name) => (
            <span key={name} className="relative overflow-hidden">
              <Image
                src={`/images/landing/${name}.webp`}
                alt=""
                fill
                sizes="110px"
                className="object-cover blur-[7px] brightness-50"
              />
            </span>
          ))}
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className={`rounded-sm bg-background/55 px-2.5 py-1.5 ${MONO_LABEL} text-[9px] tracking-[0.16em] text-accent`}
          >
            {en ? 'AFTER THE EVENT' : 'AZ ESEMÉNY VÉGÉN'}
          </span>
        </span>
      </div>

      <span className="flex-1" />

      <div className="flex flex-col gap-1.5">
        <span
          className={`flex items-center gap-2.5 rounded-[11px] border border-white/13 px-3.5 py-2.5 ${MONO_LABEL} text-[10px] text-foreground/55`}
        >
          <span className="size-[13px] shrink-0 rounded-full border border-white/30" />
          {en ? 'INSTANTLY' : 'AZONNAL'}
        </span>
        <span
          className={`flex items-center gap-2.5 rounded-[11px] border border-accent/50 bg-accent/9 px-3.5 py-2.5 ${MONO_LABEL} text-[10px] font-semibold text-foreground`}
        >
          <span className="size-[13px] shrink-0 rounded-full border-4 border-accent" />
          {en ? 'AT THE END' : 'AZ ESEMÉNY VÉGÉN'}
        </span>
      </div>

      <div className="mt-4.5 flex items-center gap-3">
        <span className="h-0.5 flex-1 overflow-hidden rounded-[2px] bg-white/10">
          <span className="block h-full w-3/4 bg-accent" />
        </span>
        <span className="paper inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-[14px] px-5.5 text-[14px] font-semibold">
          {en ? 'Continue' : 'Tovább'}
          <ArrowRight className="size-4" />
        </span>
      </div>
    </PhoneMock>
  )
}

/** Step 02 — the host event console and the ticket `qr-card.tsx` draws. */
export function ScreenTicket({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const name = 'Anna & Péter'
  const url = eventUrl(`${slugify(name)}-${EXAMPLE_SLUG_SUFFIX}`, locale)

  const figures: [string, string][] = [
    ['84', en ? 'PHOTOS TAKEN' : 'KÉP KÉSZÜLT'],
    ['12', en ? 'GUESTS' : 'VENDÉG'],
    ['24', en ? 'SHOTS EACH' : 'KÉP FEJENKÉNT'],
  ]

  return (
    <PhoneMock>
      <div className="flex items-center justify-between">
        <span
          className={`${MONO_LABEL} text-[9px] tracking-[0.2em] text-foreground/40`}
        >
          OURFILM
        </span>
        <span className={`${MONO_LABEL} text-[9px] text-accent`}>
          {en ? 'CAMERA OPEN' : 'A KAMERA NYITVA'}
        </span>
      </div>

      <p className="mt-3.5 font-display text-[28px] leading-[1.02]">{name}</p>

      <div className="mt-5 flex border-t border-white/12 pt-3.5">
        {figures.map(([value, label], i) => (
          <span
            key={label}
            className={`flex-1 ${i > 0 ? 'border-l border-white/12 pl-3.5' : ''}`}
          >
            <span className="block font-mono text-[20px] leading-none font-medium tracking-[-0.05em]">
              {value}
            </span>
            <span
              className={`mt-1.5 block ${MONO_LABEL} text-[7.5px] text-foreground/45`}
            >
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="paper mt-5 rounded-xs p-4.5 text-center">
        <p className="font-display text-[19px] leading-[1.1]">{name}</p>
        <p
          className={`paper-muted mt-1.5 ${MONO_LABEL} text-[8px] tracking-[0.2em]`}
        >
          {en ? 'DISPOSABLE CAMERA · 24 SHOTS' : 'ELDOBHATÓ KAMERA · 24 KÉP'}
        </p>
        <span className="mx-auto mt-3.5 block w-fit bg-white p-2 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
          <QRCodeSVG
            value={url}
            size={100}
            level="M"
            bgColor="#ffffff"
            fgColor="#050505"
            marginSize={0}
          />
        </span>
        {/* Wrapping, not truncating — the same decision the real ticket makes,
            because this address is what a guest types when a code will not
            scan. */}
        <p className="paper-muted mt-3 font-mono text-[9px] leading-[1.35] font-medium break-all">
          {url.replace('https://', '')}
        </p>
        <div className="paper-rule mt-3.5 flex gap-2 border-t pt-3">
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[color:var(--paper-foreground)] py-2.5 text-[11.5px] font-semibold text-[color:var(--paper)]">
            <Download className="size-3" />
            {en ? 'Download' : 'Letöltés'}
          </span>
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[rgba(20,19,18,.2)] py-2.5 text-[11.5px] font-semibold">
            <Share2 className="size-3" />
            {en ? 'Share' : 'Megosztás'}
          </span>
        </div>
      </div>

      <span className="flex-1" />
    </PhoneMock>
  )
}

/** Step 03 — the guest screen, `#2a`: counter, roll, shutter. */
export function ScreenCamera({ locale }: { locale: Locale }) {
  const en = locale === 'en'
  const exposed = 7
  const total = 24

  return (
    <PhoneMock>
      <div className="flex items-center justify-between">
        <span
          className={`${MONO_LABEL} text-[9px] tracking-[0.2em] text-foreground/40`}
        >
          OURFILM
        </span>
        <span
          className={`inline-flex items-center gap-1.5 ${MONO_LABEL} text-[9px] text-accent`}
        >
          <span className="size-[5px] rounded-full bg-accent" />
          {en ? 'LIVE · 6H 20M' : 'NYITVA · 6Ó 20P'}
        </span>
      </div>

      <p className="mt-3.5 font-display text-[30px] leading-[1.02]">
        Anna &amp; Péter
      </p>

      <div className="mt-6 flex items-end gap-2.5">
        <span className="font-mono text-[54px] leading-[0.82] font-medium tracking-[-0.06em]">
          {total - exposed}
        </span>
        <span className="pb-1 font-mono text-[16px] tracking-[-0.03em] text-foreground/35">
          /{total}
        </span>
        <span
          className={`ml-auto pb-1.5 text-right ${MONO_LABEL} text-[8.5px] leading-[1.5] text-foreground/50`}
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

      {/* The roll as a bar rather than 52px cells: at 212px of screen the real
          strip would show four frames and no boundary, which is the one thing
          it exists to show. Lilac is the frames-remaining bar — one of the four
          things the colour is still allowed to mean. */}
      <div className="film mt-4 flex flex-wrap gap-[5px] rounded-xs px-2 py-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-[5px] w-2 rounded-[1.5px] ${
              i < exposed ? 'bg-accent' : 'film-perf'
            }`}
          />
        ))}
      </div>

      <p className="mt-5 font-mono text-[9.5px] tracking-[0.06em] text-foreground/40">
        {en
          ? '7 GUESTS · NO PREVIEW · NO RETAKES'
          : '7 VENDÉG · NINCS ELŐNÉZET · NINCS ÚJRAPRÓBÁLÁS'}
      </p>

      <span className="flex-1" />

      <div className="flex items-center gap-2.5">
        <span className="paper inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] text-[14.5px] font-semibold">
          <Camera className="size-4" strokeWidth={1.8} />
          {en ? 'Camera' : 'Kamera'}
        </span>
        <span className="flex size-[56px] items-center justify-center rounded-[18px] border border-white/14 text-foreground/75">
          <Share2 className="size-4" strokeWidth={1.8} />
        </span>
      </div>
    </PhoneMock>
  )
}
