import { formatDeadline } from '@/lib/format'
import { legalConfig, legalText, type LegalConfig } from '@/lib/legal/config'
import { ACTIVE_MONTHS, GRACE_DAYS } from '@/lib/retention'

/**
 * The retention warning, and the line the host's settings page shows.
 *
 * No approved Hungarian was supplied for the warning email, so none is
 * invented: the body is the ÁSZF's own section 9 sentence — already approved,
 * already the rule this email is about — plus the event's name and the two
 * dates. Writing fresh legal prose for a notice whose whole job is to restate
 * a contractual term is exactly the thing the brief rules out.
 */

export const RETENTION_EMAIL_SUBJECT =
  'Az eseményed képei 30 nap múlva törlődnek – OurFilm'

/** The approved ÁSZF sentence, with the two periods resolved from config. */
export function retentionRuleSentence(
  config: LegalConfig = legalConfig,
): string {
  return `Az eseményalbum az esemény végétől számított ${config.service.activeAlbumMonths} hónapig aktívan elérhető. A ${config.service.activeAlbumMonths} hónapos időszakot további ${config.service.deletionWarningDays} napos türelmi idő követi, amely alatt a Házigazda még letöltheti a tartalmat. A türelmi idő lejárta után az esemény képei és az eseményhez kapcsolódó, további megőrzési kötelezettség alá nem eső adatok az aktív rendszerekből véglegesen törlésre kerülnek.`
}

export function retentionEmailBody(
  {
    eventName,
    deleteAfterIso,
    timeZone,
    eventUrl,
  }: {
    eventName: string
    deleteAfterIso: string
    timeZone: string
    eventUrl: string
  },
  config: LegalConfig = legalConfig,
): string {
  return [
    'Szia!',
    '',
    `Az „${eventName}” esemény elérte a ${config.service.activeAlbumMonths} hónapos aktív időszak végét.`,
    '',
    retentionRuleSentence(config),
    '',
    `A törlés várható időpontja: ${formatDeadline(deleteAfterIso, timeZone)}`,
    `Az esemény kezelése és a képek letöltése: ${eventUrl}`,
    '',
    `Kapcsolat: ${legalText(config.provider.email)}`,
    '',
    'OurFilm',
  ].join('\n')
}

/** What the host's settings page says about this event's retention. */
export function retentionNotice({
  state,
  activeUntilIso,
  deleteAfterIso,
  timeZone,
  legalHoldReason,
}: {
  state: 'active' | 'grace' | 'due' | 'hold'
  activeUntilIso: string
  deleteAfterIso: string
  timeZone: string
  legalHoldReason: string | null
}): { heading: string; detail: string } {
  switch (state) {
    case 'hold':
      return {
        heading: 'Az automatikus törlés felfüggesztve',
        detail:
          legalHoldReason ??
          'Az eseményt jogi okból megőrizzük. Az automatikus törlés nem fut le rá.',
      }
    case 'grace':
      return {
        heading: 'Türelmi idő — töltsd le a képeket',
        detail: `Az aktív időszak lejárt. A képek ${formatDeadline(deleteAfterIso, timeZone)}-ig érhetők el, utána véglegesen törlődnek.`,
      }
    case 'due':
      return {
        heading: 'A türelmi idő lejárt',
        detail:
          'Az esemény a következő automatikus törléskor véglegesen törlődik az aktív rendszerekből.',
      }
    default:
      return {
        heading: 'Meddig érhető el az album',
        detail: `Az album ${formatDeadline(activeUntilIso, timeZone)}-ig aktív, utána ${GRACE_DAYS} nap türelmi idő következik. Az esemény végétől számítva ez ${ACTIVE_MONTHS} hónap.`,
      }
  }
}
