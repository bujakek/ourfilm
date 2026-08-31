import { z } from 'zod'

import type { Locale } from '@/lib/i18n'

export const guestCountRanges = [
  '1-50',
  '51-100',
  '101-150',
  '151-200',
  '200+',
] as const

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  partnerName: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null)
    .refine((value) => value === null || value.length >= 2),
  email: z.string().trim().toLowerCase().email().max(320),
  weddingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`)
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      )
    }),
  weddingLocation: z.string().trim().min(2).max(160),
  guestCountRange: z.enum(guestCountRanges),
  whyInterested: z.string().trim().min(10).max(2_000),
  locale: z.enum(['en', 'hu']),
  agreementAccepted: z.literal('accepted'),
  website: z.string().max(200),
  utmSource: z.string().trim().max(200),
  utmMedium: z.string().trim().max(200),
  utmCampaign: z.string().trim().max(200),
  utmContent: z.string().trim().max(200),
  utmTerm: z.string().trim().max(200),
})

export type EarlyCoupleApplication = Omit<
  z.infer<typeof applicationSchema>,
  'agreementAccepted' | 'website'
>

function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export function parseEarlyCoupleApplication(
  formData: FormData,
  now = new Date(),
) {
  // Read the honeypot before validating the real fields. Most form bots submit
  // an incomplete payload, and returning a normal validation error would tell
  // them exactly how to tune it.
  if (field(formData, 'website').trim()) {
    return { ok: false as const, reason: 'bot' as const }
  }

  const result = applicationSchema.safeParse({
    name: field(formData, 'name'),
    partnerName: field(formData, 'partnerName'),
    email: field(formData, 'email'),
    weddingDate: field(formData, 'weddingDate'),
    weddingLocation: field(formData, 'weddingLocation'),
    guestCountRange: field(formData, 'guestCountRange'),
    whyInterested: field(formData, 'whyInterested'),
    locale: field(formData, 'locale'),
    agreementAccepted: field(formData, 'agreementAccepted'),
    website: field(formData, 'website'),
    utmSource: field(formData, 'utmSource'),
    utmMedium: field(formData, 'utmMedium'),
    utmCampaign: field(formData, 'utmCampaign'),
    utmContent: field(formData, 'utmContent'),
    utmTerm: field(formData, 'utmTerm'),
  })

  if (!result.success) return { ok: false as const, reason: 'invalid' as const }
  const today = now.toISOString().slice(0, 10)
  if (result.data.weddingDate < today) {
    return { ok: false as const, reason: 'past_date' as const }
  }

  return {
    ok: true as const,
    application: {
      name: result.data.name,
      partnerName: result.data.partnerName,
      email: result.data.email,
      weddingDate: result.data.weddingDate,
      weddingLocation: result.data.weddingLocation,
      guestCountRange: result.data.guestCountRange,
      whyInterested: result.data.whyInterested,
      locale: result.data.locale,
      utmSource: result.data.utmSource,
      utmMedium: result.data.utmMedium,
      utmCampaign: result.data.utmCampaign,
      utmContent: result.data.utmContent,
      utmTerm: result.data.utmTerm,
    },
  }
}

export function earlyCoupleError(
  locale: Locale,
  reason: 'invalid' | 'past_date',
) {
  if (locale === 'en') {
    return reason === 'past_date'
      ? 'Choose a wedding date that has not passed yet.'
      : 'Check the highlighted details and try again.'
  }

  return reason === 'past_date'
    ? 'Olyan esküvői dátumot válassz, amely még nem múlt el.'
    : 'Nézd át a megadott adatokat, majd próbáld újra.'
}
