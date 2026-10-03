import type { Locale } from './i18n'
import { FREE_PARTICIPANT_LIMIT } from './onboarding'

/**
 * The strings the pages around the homepage share: the footer, the closing
 * section every page ends on, the create button. Page-specific copy stays in
 * each page, the way the rest of the marketing site keeps it.
 */
export const siteCopy = {
  en: {
    create: 'Create for free',
    skip: 'Skip to content',
    closing: {
      titleLines: ['Live it together.', 'Keep it together.'],
      helper: `Free for up to ${FREE_PARTICIPANT_LIMIT} guests. No card required.`,
    },
    faqKicker: 'FAQ',
    faqTitle: 'Still curious?',
    footer: {
      aria: 'Footer',
      taglineLines: [
        'One day becomes a lasting memory',
        'when we keep it together.',
      ],
      product: 'Product',
      occasions: 'Occasions',
      help: 'Help',
      company: 'OurFilm',
      links: {
        howItWorks: 'How it works',
        tryIt: 'Try it',
        pricing: 'Pricing',
        login: 'Log in',
        faq: 'Questions',
        contact: 'Contact',
        privacy: 'Privacy',
        terms: 'Terms',
        withdrawal: 'Right of withdrawal',
        blog: 'Blog',
        about: 'About us',
        legal: 'Legal notice',
        alternatives: 'Alternatives',
      },
      language: 'Magyar',
    },
  },
  hu: {
    create: 'Hozd létre ingyen',
    skip: 'Ugrás a tartalomra',
    closing: {
      titleLines: ['Együtt megélni.', 'Együtt megőrizni.'],
      helper: `${FREE_PARTICIPANT_LIMIT} vendégig ingyenes. Bankkártya nélkül.`,
    },
    faqKicker: 'GYIK',
    faqTitle: 'Ha még kíváncsi vagy',
    footer: {
      aria: 'Lábléc',
      taglineLines: ['Egyetlen napból örök emlék,', 'ha együtt őrizzük meg.'],
      product: 'Termék',
      occasions: 'Alkalmak',
      help: 'Segítség',
      company: 'OurFilm',
      links: {
        howItWorks: 'Így működik',
        tryIt: 'Próbáld ki',
        pricing: 'Árak',
        login: 'Belépés',
        faq: 'Gyakori kérdések',
        contact: 'Kapcsolat',
        privacy: 'Adatvédelem',
        terms: 'ÁSZF',
        withdrawal: 'Elállás a szerződéstől',
        blog: 'Blog',
        about: 'Rólunk',
        legal: 'Impresszum',
        alternatives: 'Alternatívák',
      },
      language: 'English',
    },
  },
} satisfies Record<Locale, object>
