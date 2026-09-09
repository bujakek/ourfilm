// The explicit .ts extension lets `scripts/render-auth-templates.ts` run this
// module under bare `node`, which is how the static local-stack templates are
// kept identical to what the hook sends.
import { renderEmailLayout } from './email/layout.ts'

export type AuthEmailLocale = 'en' | 'hu'

export type AuthEmailAction =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'reauthentication'
  | string

export interface AuthEmailData {
  tokenHash: string
  redirectTo?: string
  action: AuthEmailAction
}

interface AuthEmailCopy {
  subject: string
  eyebrow: string
  heading: string
  intro: string
  button: string
  validity: string
  deviceNote: string
  fallback: string
  ignored: string
  footer: string
}

function asLocale(value: unknown): AuthEmailLocale | null {
  return value === 'en' || value === 'hu' ? value : null
}

function localeFromUrl(value: string | undefined): AuthEmailLocale | null {
  if (!value) return null

  try {
    const url = new URL(value, 'https://ourfilm.app')
    const direct = asLocale(url.searchParams.get('lang'))
    if (direct) return direct

    const next = url.searchParams.get('next')
    if (!next) return null

    return asLocale(
      new URL(next, 'https://ourfilm.app').searchParams.get('lang'),
    )
  } catch {
    return null
  }
}

/**
 * The URL belongs to the individual auth request, so it wins over account
 * metadata: a returning host can deliberately switch the UI language. The
 * nested `next` lookup keeps links requested before the direct `lang` rollout
 * working, while metadata gives old callers a durable fallback.
 */
export function resolveAuthEmailLocale(
  redirectTo: string | undefined,
  userMetadata: unknown,
): AuthEmailLocale {
  const fromUrl = localeFromUrl(redirectTo)
  if (fromUrl) return fromUrl

  if (userMetadata && typeof userMetadata === 'object') {
    const fromMetadata = asLocale(
      (userMetadata as Record<string, unknown>).locale,
    )
    if (fromMetadata) return fromMetadata
  }

  // OurFilm started as a Hungarian-only product, so legacy accounts without
  // either signal should keep receiving the language they signed up with.
  return 'hu'
}

export function buildAuthVerificationUrl(
  supabaseUrl: string,
  data: AuthEmailData,
): string {
  const url = new URL('/auth/v1/verify', supabaseUrl)
  url.searchParams.set('token', data.tokenHash)
  url.searchParams.set('type', data.action)
  if (data.redirectTo) url.searchParams.set('redirect_to', data.redirectTo)
  return url.toString()
}

function requiresSameBrowser(redirectTo: string | undefined): boolean {
  if (!redirectTo) return false

  try {
    const url = new URL(redirectTo, 'https://ourfilm.app')
    const next = url.searchParams.get('next')
    const destination = next ? new URL(next, 'https://ourfilm.app') : url
    return destination.pathname === '/auth/event-complete'
  } catch {
    return false
  }
}

function copyFor(
  locale: AuthEmailLocale,
  action: AuthEmailAction,
  sameBrowser: boolean,
): AuthEmailCopy {
  const en = locale === 'en'

  const actionCopy = en
    ? {
        signup: {
          subject: 'Confirm your email — OurFilm',
          eyebrow: 'CREATE ACCOUNT',
          heading: 'One more step',
          intro:
            'Confirm your email to create your account and sign in. No password needed.',
          button: 'Create account',
        },
        magiclink: {
          subject: 'Your OurFilm sign-in link',
          eyebrow: 'SIGN IN',
          heading: 'Your sign-in link',
          intro:
            'Use the button below to open your events. No password needed.',
          button: 'Sign in',
        },
        recovery: {
          subject: 'Reset your OurFilm password',
          eyebrow: 'PASSWORD RESET',
          heading: 'Reset your password',
          intro: 'Use the button below to choose a new password.',
          button: 'Reset password',
        },
        invite: {
          subject: "You've been invited to OurFilm",
          eyebrow: 'INVITATION',
          heading: 'Join OurFilm',
          intro: 'Accept the invitation to finish setting up your account.',
          button: 'Accept invitation',
        },
        email_change: {
          subject: 'Confirm your new email — OurFilm',
          eyebrow: 'EMAIL CHANGE',
          heading: 'Confirm your new email',
          intro: 'Use the button below to confirm this email address.',
          button: 'Confirm email',
        },
        reauthentication: {
          subject: "Confirm it's you — OurFilm",
          eyebrow: 'SECURITY CHECK',
          heading: "Confirm it's you",
          intro: 'Use the secure link below to continue.',
          button: 'Continue',
        },
      }
    : {
        signup: {
          subject: 'OurFilm: erősítsd meg az e-mail-címed',
          eyebrow: 'FIÓK LÉTREHOZÁSA',
          heading: 'Már csak egy lépés',
          intro:
            'Erősítsd meg az e-mail-címed, mi pedig létrehozzuk a fiókod és beléptetünk. Jelszóra sem lesz szükséged.',
          button: 'Fiók létrehozása',
        },
        magiclink: {
          subject: 'Belépési link az OurFilmhez',
          eyebrow: 'BELÉPÉS',
          heading: 'Itt a belépési link',
          intro:
            'Az alábbi gombbal megnyithatod az eseményeidet. Jelszóra nincs szükség.',
          button: 'Belépés',
        },
        recovery: {
          subject: 'OurFilm-jelszó visszaállítása',
          eyebrow: 'JELSZÓ-VISSZAÁLLÍTÁS',
          heading: 'Állíts be új jelszót',
          intro: 'Az alábbi gombbal új jelszót állíthatsz be.',
          button: 'Új jelszó beállítása',
        },
        invite: {
          subject: 'Meghívást kaptál az OurFilmhez',
          eyebrow: 'MEGHÍVÁS',
          heading: 'Csatlakozz az OurFilmhez',
          intro: 'Fogadd el a meghívást, és fejezd be a fiókod beállítását.',
          button: 'Meghívás elfogadása',
        },
        email_change: {
          subject: 'OurFilm: erősítsd meg az új e-mail-címed',
          eyebrow: 'E-MAIL-CÍM MÓDOSÍTÁSA',
          heading: 'Erősítsd meg az új e-mail-címed',
          intro: 'Az alábbi gombbal erősítheted meg ezt az e-mail-címet.',
          button: 'E-mail-cím megerősítése',
        },
        reauthentication: {
          subject: 'OurFilm: erősítsd meg, hogy te vagy',
          eyebrow: 'BIZTONSÁGI ELLENŐRZÉS',
          heading: 'Erősítsd meg, hogy te vagy',
          intro: 'Az alábbi biztonságos linkkel folytathatod.',
          button: 'Folytatás',
        },
      }

  const selected =
    actionCopy[action as keyof typeof actionCopy] ?? actionCopy.magiclink

  return {
    ...selected,
    validity: en
      ? 'The link is valid for one hour and can be used once.'
      : 'A link egy órán át érvényes, és csak egyszer használható.',
    deviceNote: sameBrowser
      ? en
        ? 'Open it in the same browser where you created your event. Your unfinished event is saved there.'
        : 'Ugyanabban a böngészőben nyisd meg, ahol elkezdted az esemény létrehozását. Csak ott tudod folytatni.'
      : en
        ? 'For your security, do not forward this email.'
        : 'A biztonságod érdekében ne továbbítsd ezt a levelet.',
    fallback: en
      ? 'If the button does not work, copy this address into your browser:'
      : 'Ha a gomb nem működik, másold be ezt a címet a böngésződbe:',
    ignored: en
      ? 'If you did not request this email, you can safely ignore it.'
      : 'Ha nem te kérted ezt a levelet, nyugodtan hagyd figyelmen kívül.',
    footer: en ? 'shared event photos' : 'közös eseményfotók',
  }
}

export function renderAuthEmail({
  locale,
  action,
  confirmationUrl,
  redirectTo,
}: {
  locale: AuthEmailLocale
  action: AuthEmailAction
  confirmationUrl: string
  redirectTo?: string
}): { subject: string; html: string; text: string } {
  const copy = copyFor(locale, action, requiresSameBrowser(redirectTo))
  const { html, text } = renderEmailLayout({
    locale,
    preheader: copy.intro,
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    intro: [copy.intro],
    button: { label: copy.button, url: confirmationUrl },
    underButton: copy.validity,
    note: copy.deviceNote,
    fallbackUrl: confirmationUrl,
    footer: copy.ignored,
  })
  return { subject: copy.subject, html, text }
}
