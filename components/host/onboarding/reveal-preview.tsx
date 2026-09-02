import { Clock } from 'lucide-react'
import Image from 'next/image'

/**
 * Two sample guest photos, and the promise the screen is actually making.
 *
 * Blurred or sharp is the whole point: it is the same picture a guest will be
 * looking at, in the state the host's answer puts it in. A row of radio buttons
 * can describe a reveal; only this can show one.
 *
 * The photos are OurFilm's own marketing shots — the same two the landing page
 * uses — so nothing new is downloaded and nothing borrowed appears here. The
 * names are sample copy for the credit a real gallery shows over each tile.
 */
const SAMPLES = [
  { src: '/images/guests-laughing.webp', name: 'Nóra' },
  { src: '/images/evening-party.webp', name: 'Bence' },
]

export function RevealPreview({
  blurred,
  badge,
}: {
  blurred: boolean
  /** What the badge over the pair says — either "now" or a resolved moment. */
  badge: string
}) {
  return (
    // flex-1 up to a cap: the pair grows into whatever the screen has spare and
    // stops at roughly the 7:10 tiles the design calls for, so a tall phone gets
    // breathing room rather than two poster-shaped photos. min-h-0 is what lets
    // it shrink again on a short one instead of pushing the choices off-screen.
    <div className="relative grid max-h-60 min-h-0 w-full flex-1 grid-cols-2 gap-2">
      {SAMPLES.map((photo) => (
        <div
          key={photo.src}
          // Illustration, not content: the alt text would describe a stock
          // photo of nobody the host knows, and the sentence that matters — when
          // the album opens — is the badge below, which is real text.
          aria-hidden="true"
          className="relative overflow-hidden rounded-2xl border border-border"
        >
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="(max-width: 448px) 50vw, 224px"
            // scale-105 under the blur: a blurred layer samples past its own
            // edge, so an unscaled image fades to transparent at the corners
            // and the card reads as a bug rather than as a hidden photo.
            className={`object-cover transition-[filter,transform] duration-300 ${
              blurred ? 'scale-105 blur-[14px]' : ''
            }`}
          />
          <span className="absolute top-3 left-3 text-sm font-medium text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.95)]">
            {photo.name}
          </span>
        </div>
      ))}

      {/* Centred across the pair rather than inside one of them: it describes
          the album, not a photo.

          A flat scrim rather than `.glass`: this badge is the one surface in
          the product that always sits over photography, and a white-gradient
          film over a warm blurred photo turns brown. No `backdrop-blur` either
          — the same reason `.glass` drops its own on touch devices, and here it
          would be re-blurring an already-blurred layer. */}
      <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto flex w-fit max-w-full -translate-y-1/2 items-center gap-2 rounded-full border border-border-strong bg-background/80 px-3.5 py-2.5 text-center font-mono text-[10px] leading-[1.5] font-medium tracking-[0.08em] text-balance">
        <Clock
          className="size-3.5 shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        {badge}
      </p>
    </div>
  )
}
