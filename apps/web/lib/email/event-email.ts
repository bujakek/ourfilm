import { renderEmailLayout } from './layout'
import type { Locale } from '../i18n'
import { eventUrl, SITE_URL } from '../site'
import { formatDeadline } from '../format'

export type EventEmailKind = 'created' | 'upcoming' | 'ended'

type EventEmailInput = {
  locale: Locale
  eventName: string
  slug: string
  photoCount: number
} & (
  | { kind: 'upcoming' | 'ended' }
  | {
      kind: 'created'
      captureEndAt: string
      timeZone: string
      revealMode: 'instant' | 'event_end' | 'custom'
      revealAt: string
      guestsCanView: boolean
    }
)

export function renderEventEmail(input: EventEmailInput): {
  subject: string
  html: string
  text: string
} {
  const { kind, locale, eventName, slug, photoCount } = input
  const hu = locale === 'hu'
  const upcoming = kind === 'upcoming'
  const url = `${SITE_URL}/host/events/${slug}?lang=${locale}`
  const guestUrl = eventUrl(slug, locale)
  if (input.kind === 'created') {
    const end = formatDeadline(input.captureEndAt, input.timeZone, locale)
    const reveal = formatDeadline(input.revealAt, input.timeZone, locale)
    const visibility = !input.guestsCanView
      ? hu
        ? 'A galériát csak te láthatod; a vendégeid fotózhatnak, de a képeket nem nézhetik meg.'
        : 'Only you can view the gallery; your guests can take photos but cannot view them.'
      : input.revealMode === 'instant'
        ? hu
          ? 'A vendégeid azonnal láthatják a feltöltött képeket.'
          : 'Your guests can see uploaded photos immediately.'
        : hu
          ? `A képek ekkor jelennek meg a vendégeidnek: ${reveal}.`
          : `Photos will be revealed to your guests on ${reveal}.`
    return {
      subject: hu
        ? `Elkészült a kamerád: ${eventName}`
        : `Your camera is ready: ${eventName}`,
      ...renderEmailLayout({
        locale,
        preheader: hu
          ? 'Az eseményed létrejött. Itt találod a linkjét és a beállításait.'
          : 'Your event is created. Here are its link and settings.',
        eyebrow: hu ? 'Elkészült a kamerád' : 'Your camera is ready',
        heading: eventName,
        intro: [
          hu
            ? 'Elkészült a kamerád! A vendégeid már csatlakozhatnak, és elkezdhetnek fotózni. Nem kell hozzá alkalmazás vagy regisztráció.'
            : 'Your camera is ready! Guests can join and start taking photos now. No app or account needed.',
          hu
            ? `Eddig lehet fotózni: ${end}.`
            : `The camera is open until ${end}.`,
          visibility,
          hu
            ? `Ezt a linket küldd el a vendégeidnek: ${guestUrl}`
            : `Send this link to your guests: ${guestUrl}`,
        ],
        button: { label: hu ? 'Esemény kezelése' : 'Manage your event', url },
        note: hu
          ? 'A nyomtatható QR-kódot az esemény oldalán, a QR-kód gombbal töltheted le. Ezt a levelet őrizd meg, hogy később is könnyen megtaláld az eseményedet.'
          : 'Download your printable QR code using the QR code button on your event page. Keep this email so you can find your event again later.',
        fallbackUrl: url,
        footer: hu
          ? 'Azért kaptad ezt a levelet, mert létrehoztál egy eseményt az OurFilmben.'
          : 'You received this email because you created an event on OurFilm.',
      }),
    }
  }
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
              ? 'Közeleg az eseményed! Nyomtasd ki a QR-kódokat, és tedd őket szem elé: a bejárathoz, az asztalokra vagy a bárpultra.'
              : 'Your event is coming up! Remember to print your QR codes and put them by the entrance, on the tables or at the bar.',
            hu
              ? 'Szólj róla az esemény elején: „A QR-kóddal ti is fotózhattok nekünk.” Így mindenki tudja, mire való a kód.'
              : 'Mention it when the event begins: “Scan the QR code to take photos for us.” That way, everyone knows what the code is for.',
            hu
              ? 'Készítsd el te az első képet, és mutasd meg a vendégeidnek, hogyan működik.'
              : 'Take the first photo yourself and show your guests how it works.',
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
