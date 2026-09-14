import { developingWash } from '@/lib/developing-wash'
import { developingTileLabel, moreDevelopingLabel } from '@/lib/event-copy'
import type { Locale } from '@/lib/i18n'
import type { DevelopingTile } from '@/lib/photos'

/**
 * The reveal-locked gallery, as the roll it is.
 *
 * Laid out exactly like `PhotoGrid` — three across, square, the same gap — so
 * the moment the album opens every tile is replaced in place rather than the
 * section changing shape.
 *
 * None of this is a photo, blurred or otherwise. The server sent a name and a
 * seed per frame and nothing else (see `lib/photos.ts`), so there is nothing
 * underneath to un-blur: the blur is on a wash of the palette, and it is there
 * because a soft edge is what reads as "not developed yet".
 *
 * Keyed by position because there is no id to key on, by design. The wall is
 * redrawn whole on each refresh, which is also the only time it changes.
 */
export function DevelopingGallery({
  tiles,
  total,
  revealAt,
  now,
  locale,
}: {
  tiles: DevelopingTile[]
  total: number
  revealAt: string
  now: number
  locale: Locale
}) {
  const label = developingTileLabel(new Date(revealAt), new Date(now), locale)
  const more = total - tiles.length

  return (
    <ul className="grid grid-cols-3 gap-1.5">
      {tiles.map((tile, i) => (
        <li
          key={i}
          className="relative aspect-square overflow-hidden rounded-sm bg-film"
        >
          {/* Oversized under the blur for the same reason the real tile scales
              to 1.04: a blur inside `overflow-hidden` pulls transparent edges
              into frame. */}
          <span
            aria-hidden="true"
            className="absolute -inset-3 blur-lg"
            style={{ background: developingWash(tile.seed) }}
          />
          <span className="absolute inset-x-1.5 top-1/2 flex -translate-y-1/2 justify-center">
            <span className="truncate rounded-full bg-background/40 px-2 py-0.5 text-[10px] leading-[1.4] font-medium text-foreground/80 backdrop-blur-sm">
              {label}
            </span>
          </span>
          {tile.uploaderName ? (
            <span className="absolute inset-x-2 bottom-1.5 truncate font-display text-[13px] leading-tight text-foreground/85 italic">
              {tile.uploaderName}
            </span>
          ) : null}
        </li>
      ))}
      {more > 0 ? (
        <li className="flex aspect-square items-center justify-center rounded-sm border border-border font-mono text-xs text-muted-foreground">
          {moreDevelopingLabel(more, locale)}
        </li>
      ) : null}
    </ul>
  )
}
