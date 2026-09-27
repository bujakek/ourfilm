import type { LandingOccasionId } from '@/lib/landing-copy'

/**
 * What is on the phones for each occasion tab, and on the hero's and the
 * closing section's pair. Only the photographs change — the screens are the
 * same product whatever the event, which is the point the tabs make.
 *
 * `undefined` keeps the wedding the mocks were drawn with.
 */
const photo = (name: string) => `/images/${name}.webp`

export const OCCASION_PHOTOS: Record<
  LandingOccasionId,
  readonly string[] | undefined
> = {
  wedding: undefined,
  birthday: ['birthday', 'guests-laughing', 'party', 'wedding-cake'].map(photo),
  travel: ['travel', 'group-lookout', 'evening-party', 'guests-laughing'].map(
    photo,
  ),
  party: ['party', 'evening-party', 'guests-laughing', 'garden-party'].map(
    photo,
  ),
  everyday: ['everyday', 'garden-party', 'guests-laughing', 'travel'].map(
    photo,
  ),
}

/** "A weekend together": the hero's and the closing section's roll. */
export const WEEKEND_PHOTOS = [
  'guests-laughing',
  'travel',
  'evening-party',
  'group-lookout',
  'garden-party',
].map(photo)
