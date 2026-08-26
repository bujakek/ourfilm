import type { Locale } from '@/lib/i18n'

import type { Hub } from './kinds'

/**
 * The Hungarian a hub is named with, in one place.
 *
 * The same words appear in the breadcrumb trail, on the hub's own header, in
 * the footer and in the cross-links between hubs. Four copies of "Alternatívák"
 * is four chances for one of them to say something else.
 */
export interface HubCopy {
  /** Short name, used in breadcrumbs, the footer and cross-links. */
  label: string
  eyebrow: string
  title: string
  lead: string
}

export const hubCopy: Record<Locale, Record<Hub, HubCopy>> = {
  hu: {
    blog: {
      label: 'Blog',
      eyebrow: 'BLOG',
      title: 'Útmutatók vendégfotókhoz',
      lead: 'Gyakorlati ötletek ahhoz, hogy a vendégeitek fotói egy közös filmbe kerüljenek — a QR-kód kihelyezésétől az esküvő utáni mentésig.',
    },
    alternativak: {
      label: 'Alternatívák',
      eyebrow: 'ALTERNATÍVÁK',
      title: 'OurFilm alternatívaként',
      lead: 'Mit ad az OurFilm a külföldi vendégkamera- és fotómegosztó szolgáltatásokhoz képest, és mikor jobb választás a másik.',
    },
    osszehasonlitas: {
      label: 'Összehasonlítás',
      eyebrow: 'ÖSSZEHASONLÍTÁS',
      title: 'Vendégkamerák egymás mellett',
      lead: 'Képlimit, előhívás, vendégalkalmazás és ár — az OurFilm és a piac többi megoldása szempontról szempontra.',
    },
  },
}

/** The label the money pages are collected under. They have no hub of their
 *  own: a landing page is an entry point, not something you browse a list of. */
export const solutionsLabel: Record<Locale, { title: string; lead: string }> = {
  hu: {
    title: 'Megoldások',
    lead: 'A leggyakoribb kérdések, amivel a párok elindulnak.',
  },
}

export const homeLabel: Record<Locale, string> = { hu: 'Főoldal' }
