import { renderEmailLayout } from './layout'
import type { Locale } from '../i18n'
import { eventUrl, SITE_URL } from '../site'

export type EventEmailKind = 'upcoming' | 'ended'

export function renderEventEmail(input: {
  kind: EventEmailKind
  locale: Locale
  eventName: string
  slug: string
  photoCount: number
}): { subject: string; html: string; text: string } {
  const { kind, locale, eventName, slug, photoCount } = input
  const hu = locale === 'hu'
  const upcoming = kind === 'upcoming'
  const url = `${SITE_URL}/host/events/${slug}?lang=${locale}`
  const guestUrl = eventUrl(slug, locale)
  const count = new Intl.NumberFormat(hu ? 'hu-HU' : 'en').format(photoCount)
  const subject = upcoming
    ? hu
      ? `Hamarosan itt az eseményed: ${eventName}`
      : `Your event is coming up: ${eventName}`
    : hu
      ? `Az eseményed emlékei: ${eventName}`
      : `Memories from your event: ${eventName}`

  return {
    subject,
    ...renderEmailLayout({
      locale,
      preheader: upcoming
        ? hu
          ? 'Nyomtasd ki a QR-kódokat, és küldd el a linket a vendégeidnek.'
          : 'Print your QR codes and share the event link with your guests.'
        : hu
          ? 'Reméljük, csodás volt az eseményed.'
          : 'We hope your event was amazing.',
      eyebrow: upcoming
        ? hu
          ? 'Készülj az eseményre'
          : 'Get ready'
        : hu
          ? 'Az esemény után'
          : 'After your event',
      heading: eventName,
      intro: upcoming
        ? [
            hu
              ? 'Közeleg az eseményed! Ne felejtsd el kinyomtatni a QR-kódokat, és kitenni őket oda, ahol a vendégek könnyen megtalálják.'
              : 'Your event is coming up! Remember to print your QR codes and put them where your guests can easily find them.',
            hu
              ? 'Küldd el az esemény linkjét is minden vendégednek, hogy kéznél legyen a kamerájuk. Nem kell hozzá alkalmazás vagy regisztráció.'
              : 'Send the event link to everyone, too, so their camera is close at hand. No app or account needed.',
            hu
              ? `Ezt a linket oszd meg a vendégekkel: ${guestUrl}`
              : `Share this link with your guests: ${guestUrl}`,
          ]
        : [
            hu
              ? 'Reméljük, csodás volt az eseményed, és sok szép pillanatot éltetek át együtt.'
              : 'We hope your event was amazing and full of moments worth remembering.',
            photoCount === 0
              ? hu
                ? 'Egyelőre nem érkezett fotó az albumodba. Ha a vendégeid offline fotóztak, kérd meg őket, hogy internetkapcsolat mellett nyissák meg újra az esemény linkjét.'
                : 'No photos have reached your album yet. If your guests took photos offline, ask them to reopen the event link with an internet connection.'
              : hu
                ? `Eddig ${count} fotó érkezett az albumodba — ennyi emléket gyűjtöttetek össze az OurFilmmel.`
                : `${count} ${photoCount === 1 ? 'photo has' : 'photos have'} reached your album so far — memories you collected together with OurFilm.`,
          ],
      button: {
        label: upcoming
          ? hu
            ? 'QR-kódok nyomtatása'
            : 'Print your QR codes'
          : hu
            ? 'Esemény megnyitása'
            : 'Open your event',
        url,
      },
      note: upcoming
        ? undefined
        : hu
          ? 'Még érkezhetnek fotók azokról a telefonokról, amelyek a helyszínen offline voltak. A képek a beállított megjelenési idő szerint válnak láthatóvá.'
          : 'Photos may still arrive from phones that were offline at the event. Photos become visible according to your chosen reveal time.',
      fallbackUrl: url,
      footer: hu
        ? 'Azért kaptad ezt a levelet, mert te vagy az esemény házigazdája az OurFilmben.'
        : 'You received this email because you host this event on OurFilm.',
    }),
  }
}
