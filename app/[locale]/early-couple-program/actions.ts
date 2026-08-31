'use server'

import {
  earlyCoupleError,
  parseEarlyCoupleApplication,
  type EarlyCoupleApplication,
} from '@/lib/early-couple'
import { isLocale, type Locale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import { consumeRateLimit, requestFingerprint } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export type EarlyCoupleFormState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

const DUPLICATE_KEY = '23505'

function safeLocale(formData: FormData): Locale {
  const locale = String(formData.get('locale') ?? '')
  return isLocale(locale) ? locale : 'en'
}

function genericError(locale: Locale) {
  return locale === 'en'
    ? 'We could not save your application. Please try again in a moment.'
    : 'Nem sikerült menteni a jelentkezést. Próbáld újra egy kicsit később.'
}

function rateLimitError(locale: Locale) {
  return locale === 'en'
    ? 'Too many attempts from this connection. Please try again in 15 minutes.'
    : 'Túl sok próbálkozás érkezett erről a kapcsolatról. Próbáld újra 15 perc múlva.'
}

function successState(locale: Locale): EarlyCoupleFormState {
  return {
    status: 'success',
    message:
      locale === 'en'
        ? 'Your application is in. I will read it personally and get back to you by email.'
        : 'Megérkezett a jelentkezésetek. Személyesen átnézem, és e-mailben jelentkezem.',
  }
}

function nullable(value: string) {
  return value || null
}

export async function submitEarlyCoupleApplication(
  _previous: EarlyCoupleFormState,
  formData: FormData,
): Promise<EarlyCoupleFormState> {
  const locale = safeLocale(formData)
  const parsed = parseEarlyCoupleApplication(formData)

  // Honeypots should look successful. A bot gets no signal that lets it tune
  // the payload, while no row or email is created.
  if (!parsed.ok && parsed.reason === 'bot') return successState(locale)
  if (!parsed.ok) {
    return {
      status: 'error',
      message: earlyCoupleError(locale, parsed.reason),
    }
  }

  const db = createAdminClient()
  const application = parsed.application

  // A retry (or a double tap that made it through React) is idempotent. Return
  // the same public result and do not send the couple a second confirmation.
  const { data: existing, error: existingError } = await db
    .from('early_couple_applications')
    .select('id')
    .eq('email', application.email)
    .maybeSingle()

  if (existingError) {
    console.error('Could not check Early Couple application', existingError)
    return { status: 'error', message: genericError(locale) }
  }
  if (existing) return successState(locale)

  const requestHeaders = await headers()

  const allowed = await consumeRateLimit({
    scope: 'early-couple',
    identifier: await requestFingerprint(),
    limit: 5,
    windowSeconds: 900,
  })
  if (!allowed) return { status: 'error', message: rateLimitError(locale) }

  const { error: insertError } = await db
    .from('early_couple_applications')
    .insert({
      name: application.name,
      partner_name: application.partnerName,
      email: application.email,
      wedding_date: application.weddingDate,
      wedding_location: application.weddingLocation,
      guest_count_range: application.guestCountRange,
      why_interested: application.whyInterested,
      locale: application.locale,
      utm_source: nullable(application.utmSource),
      utm_medium: nullable(application.utmMedium),
      utm_campaign: nullable(application.utmCampaign),
      utm_content: nullable(application.utmContent),
      utm_term: nullable(application.utmTerm),
      referrer: requestHeaders.get('referer')?.slice(0, 1_000) ?? null,
    })

  // The unique email is the race-proof half of the earlier idempotency check.
  if (insertError?.code === DUPLICATE_KEY) return successState(locale)
  if (insertError) {
    console.error('Could not save Early Couple application', insertError)
    return { status: 'error', message: genericError(locale) }
  }

  await sendApplicationEmails(application)
  return successState(locale)
}

async function sendApplicationEmails(application: EarlyCoupleApplication) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Early Couple emails skipped: RESEND_API_KEY is missing')
    return
  }

  const from =
    process.env.EARLY_COUPLE_EMAIL_FROM ??
    process.env.LEGAL_EMAIL_FROM ??
    'OurFilm <noreply@ourfilm.app>'
  const names = application.partnerName
    ? `${application.name} & ${application.partnerName}`
    : application.name
  const guestLabel = `${application.guestCountRange} guests`
  const founderText = [
    'A new Early Couple Program application arrived.',
    '',
    `Couple: ${names}`,
    `Email: ${application.email}`,
    `Wedding date: ${application.weddingDate}`,
    `Location: ${application.weddingLocation}`,
    `Estimated size: ${guestLabel}`,
    `Language: ${application.locale}`,
    '',
    'Why OurFilm:',
    application.whyInterested,
  ].join('\n')
  const confirmationText =
    application.locale === 'en'
      ? [
          `Hi ${application.name},`,
          '',
          'Thanks for applying to the OurFilm Early Couple Program.',
          'I will read your application personally and get back to you by email.',
          '',
          'If selected, you will use OurFilm free at your wedding in exchange for two short feedback calls — one before and one after the wedding.',
          '',
          'László',
          'Founder, OurFilm',
        ].join('\n')
      : [
          `Szia ${application.name}!`,
          '',
          'Köszönöm, hogy jelentkeztetek az OurFilm Early Couple Programba.',
          'Személyesen átnézem a jelentkezéseteket, és e-mailben jelentkezem.',
          '',
          'Ha bekerültök, ingyen használhatjátok az OurFilmet az esküvőtökön két rövid visszajelző beszélgetésért cserébe — egyért előtte, egyért utána.',
          '',
          'László',
          'OurFilm alapító',
        ].join('\n')

  const messages = [
    {
      from,
      to: [CONTACT_EMAIL],
      reply_to: application.email,
      subject: `Early Couple application — ${names}`,
      text: founderText,
    },
    {
      from,
      to: [application.email],
      reply_to: CONTACT_EMAIL,
      subject:
        application.locale === 'en'
          ? 'We received your OurFilm application'
          : 'Megérkezett az OurFilm jelentkezésetek',
      text: confirmationText,
    },
  ]

  const results = await Promise.allSettled(
    messages.map(async (message) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })
      if (!response.ok) {
        throw new Error(
          `Resend answered ${response.status}: ${await response.text()}`,
        )
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Early Couple email failed', result.reason)
    }
  }
}
