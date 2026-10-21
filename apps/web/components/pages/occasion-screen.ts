import type { ScreenContent } from '@/components/site/phone-mock'
import { OCCASION_PHOTOS } from '@/components/landing/screens'
import type { Locale } from '@/lib/i18n'
import { landingCopy, type LandingOccasionId } from '@/lib/landing-copy'

/** The event name and photos the homepage's occasion tabs show, so an
 *  occasion's phones look the same on its own page as they do there. */
export function occasionScreen(
  locale: Locale,
  id: LandingOccasionId,
): ScreenContent {
  return {
    name: landingCopy[locale].occasions.tabs[id].screenName,
    photos: OCCASION_PHOTOS[id],
  }
}
