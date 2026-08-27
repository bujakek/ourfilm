'use server'

import { isLocale } from '@/lib/i18n'
import { CONTACT_EMAIL } from '@/lib/site'
import { redirect } from 'next/navigation'

type LegalRequestType = 'withdrawal' | 'content'

const MAX_FIELD_LENGTH = 2_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readField(formData: FormData, name: string, max = MAX_FIELD_LENGTH) {
  return String(formData.get(name) ?? '')
    .trim()
    .slice(0, max)
}

function requestPath(
  locale: string,
  type: LegalRequestType,
  result: 'sent' | 'error',
) {
  const safeLocale = isLocale(locale) ? locale : 'hu'
  const anchor = type === 'withdrawal' ? 'elallas' : 'kepeltavolitas'
  return `/${safeLocale}/kapcsolat?legal=${result}&type=${type}#${anchor}`
}

/**
 * One deliberately small legal-support channel for the pilot.
 *
 * Resend sends the same message to the requester and, as a blind copy, to
 * OurFilm. That gives both sides a durable, timestamped copy without a ticket
 * system or a legal back office. Refunds and removals are still reviewed and
 * carried out manually.
 */
export async function submitLegalRequest(formData: FormData) {
  const rawType = readField(formData, 'requestType', 20)
  const type: LegalRequestType =
    rawType === 'content' ? 'content' : 'withdrawal'
  const locale = readField(formData, 'locale', 10)

  // A quiet honeypot prevents the most basic form bots from consuming the
  // small pilot email allowance. Return the normal success state so the bot
  // gets no useful signal.
  if (readField(formData, 'website', 200)) {
    redirect(requestPath(locale, type, 'sent'))
  }

  const name = readField(formData, 'name', 200)
  const email = readField(formData, 'email', 320)
  const eventReference = readField(formData, 'eventReference', 500)
  const details = readField(formData, 'details')
  const paymentDate = readField(formData, 'paymentDate', 100)
  const photoReference = readField(formData, 'photoReference', 1_000)

  const validCommon =
    name.length >= 2 && EMAIL.test(email) && eventReference.length >= 3
  const validSpecific =
    type === 'withdrawal'
      ? paymentDate.length >= 4
      : photoReference.length >= 3 && details.length >= 5

  if (!validCommon || !validSpecific) {
    redirect(requestPath(locale, type, 'error'))
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('Legal request email failed: RESEND_API_KEY is missing')
    redirect(requestPath(locale, type, 'error'))
  }

  const requestId = crypto.randomUUID()
  const receivedAt = new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'long',
    timeStyle: 'medium',
    timeZone: 'Europe/Budapest',
  }).format(new Date())
  const subject =
    type === 'withdrawal'
      ? 'Elállási/felmondási nyilatkozat beérkezett – OurFilm'
      : 'Képeltávolítási vagy tartalmi bejelentés beérkezett – OurFilm'
  const requestLabel =
    type === 'withdrawal'
      ? 'Elállási/felmondási nyilatkozat'
      : 'Képeltávolítási vagy tartalmi bejelentés'

  const lines = [
    'Visszaigazoljuk, hogy az OurFilm az alábbi kérelmet megkapta.',
    '',
    `Ügy típusa: ${requestLabel}`,
    `Azonosító: ${requestId}`,
    `Beérkezés: ${receivedAt}`,
    `Név: ${name}`,
    `Kapcsolattartási e-mail: ${email}`,
    `Esemény neve vagy linkje: ${eventReference}`,
  ]

  if (type === 'withdrawal') {
    lines.push(`Fizetés időpontja: ${paymentDate}`)
    if (details) lines.push(`Megjegyzés: ${details}`)
    lines.push(
      '',
      'Ez a levél a nyilatkozat beérkezését igazolja; nem jelenti a teljes összeg automatikus visszatérítését. A kérelmet az ÁSZF és a kötelező fogyasztói szabályok alapján megvizsgáljuk.',
    )
  } else {
    lines.push(`Kép azonosítása: ${photoReference}`)
    lines.push(`A kérelem indoka: ${details}`)
    lines.push(
      '',
      'A kérelmet megvizsgáljuk, és ha pontosítás szükséges, ezen az e-mail-címen jelentkezünk.',
    )
  }

  lines.push('', `Kapcsolat: ${CONTACT_EMAIL}`)

  let sent = false
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.LEGAL_EMAIL_FROM ?? 'OurFilm <noreply@ourfilm.app>',
        to: [email],
        bcc: [CONTACT_EMAIL],
        reply_to: CONTACT_EMAIL,
        subject,
        text: lines.join('\n'),
      }),
    })
    sent = response.ok
    if (!sent) {
      console.error(
        'Legal request email failed',
        response.status,
        await response.text(),
      )
    }
  } catch (error) {
    console.error('Legal request email failed', error)
  }

  redirect(requestPath(locale, type, sent ? 'sent' : 'error'))
}
