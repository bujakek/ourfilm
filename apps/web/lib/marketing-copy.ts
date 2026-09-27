import type { Locale } from './i18n'

export const marketingCopy = {
  en: {
    nav: {
      aria: 'Main navigation',
      home: 'OurFilm, back to homepage',
      links: ['How it works', 'Occasions', 'Pricing', 'About'],
      login: 'Log in',
      create: 'Create your camera',
      open: 'Open menu',
      close: 'Close menu',
    },
    benefits: {
      title: 'One camera for the whole wedding.',
      lead: 'Your photographer captures the big moments. Your guests catch everything in between.',
    },
    footer: {
      tagline: 'One camera for the whole wedding.',
      aria: 'Footer',
      copyright: 'All rights reserved.',
    },
    demo: {
      scan: 'Scan to start shooting.',
      ready: 'Ready',
      scanning: 'Scanning…',
    },
  },
  hu: {
    nav: {
      aria: 'Fő navigáció',
      home: 'OurFilm, vissza a főoldalra',
      links: ['Hogyan működik', 'Alkalmak', 'Árak', 'Rólunk'],
      login: 'Belépés',
      create: 'Hozzátok létre ingyen',
      open: 'Menü megnyitása',
      close: 'Menü bezárása',
    },
    benefits: {
      title: 'Egy kamera az egész násznépnek.',
      lead: 'A fotós megörökíti a nagy pillanatokat. A vendégeitek pedig mindazt, ami közben történik.',
    },
    footer: {
      tagline: 'Egy kamera az egész násznépnek.',
      aria: 'Lábléc',
      copyright: 'Minden jog fenntartva.',
    },
    demo: {
      scan: 'Olvasd be, és fotózz velünk.',
      ready: 'Kész',
      scanning: 'Beolvasás…',
    },
  },
} satisfies Record<Locale, object>
