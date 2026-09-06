'use server'

import { getEventQuota } from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { createEventCheckoutUrl } from '@/lib/stripe/checkout'
import { stripeIsConfigured } from '@/lib/stripe/env'
import { createClient } from '@/lib/supabase/server'
import {
  reportServerEvent,
  reportServerIssue,
  type ServerEventProperties,
} from '@/lib/telemetry-server'
import { redirect } from 'next/navigation'

export type CheckoutState = { error: string | null }

/**
 * Sends the host to Stripe Checkout to lift the free cap on one event.
 *
 * The session itself is built by `createEventCheckoutUrl`, shared with the last
 * onboarding screen. What stays here is the guarding: whether payments are on,
 * whether this host owns the event, and whether there is anything left to buy.
 *
 * Hosted Checkout rather than an embedded card form, and not for want of
 * ambition: a redirect keeps every card number, every 3-D Secure challenge and
 * every SCA rule inside Stripe's page, which is the difference between SAQ A
 * and a compliance project. The pilot is one wedding — there is no version of
 * this where building a card form is the right use of the time.
 *
 * The payment is recorded by the webhook, never here. A host who closes the
 * tab on Stripe's success page must still end up with an unlocked album, and
 * the only message that survives that is the one Stripe sends server-to-server.
 */
export async function startEventCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const slug = String(formData.get('slug') ?? '').trim()
  const en = formData.get('locale') === 'en'
  if (!slug) {
    await blocked(null, 'no_slug')
    return { error: en ? 'Event not found.' : 'Hiányzó esemény.' }
  }
  if (formData.get('legal_acceptance') !== 'on') {
    await blocked(null, 'terms_not_accepted')
    return {
      error: en
        ? 'Accept the Terms to continue to payment.'
        : 'A fizetéshez fogadd el az ÁSZF-et.',
    }
  }

  if (!stripeIsConfigured()) {
    // In production this is an incident rather than a configuration note: the
    // host is reading "payments are not switched on" on a page that offers to
    // take their money. It has never been counted.
    await blocked(null, 'stripe_not_configured')
    return {
      error: en
        ? 'Payments are not configured yet. Contact us and we can help; the album and uploads still work.'
        : 'A fizetés még nincs beállítva. Szólj nekünk, és elintézzük — addig az album és a feltöltés változatlanul működik.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    await blocked(null, 'signed_out')
    return {
      error: en
        ? 'Your session expired. Sign in again.'
        : 'Lejárt a munkameneted. Lépj be újra.',
    }
  }

  // Null covers both "no such event" and "not yours" — RLS makes them the same
  // answer, which is the correct one to give either way.
  const event = await getOwnedEventBySlug(slug)
  if (!event) {
    await blocked(null, 'not_found')
    return { error: en ? 'Event not found.' : 'Nincs ilyen esemény.' }
  }

  // The ledger deliberately has no unique index stopping a second paid row, so
  // this is the check that stops a host paying twice for the same album. It
  // reads the database predicate rather than a purchase row, so an
  // admin-owned event is correctly reported as already unlimited.
  const quota = await getEventQuota(event.id)
  if (quota.unlimited) {
    await blocked(event.id, 'already_unlimited')
    return {
      error: en
        ? 'This event is already unlimited.'
        : 'Ez az esemény már korlátlan — nincs mit fizetni.',
    }
  }

  let checkoutUrl: string
  try {
    checkoutUrl = await createEventCheckoutUrl({
      eventId: event.id,
      slug: event.slug,
      ownerId: user.id,
      ownerEmail: user.email ?? null,
      locale: event.locale,
      termsAcceptedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Stripe checkout session failed', e)
    await reportServerIssue(e, {
      operation: 'checkout_start',
      eventId: event.id,
      route: '/host/events/[slug]/settings',
      routeType: 'action',
    })
    return {
      error: en
        ? 'Could not start payment. Try again.'
        : 'Nem sikerült elindítani a fizetést. Próbáld újra.',
    }
  }

  // Reported here rather than from the browser, which is one redirect away
  // from a different origin and would lose a buffered event on the way. This
  // and its twin in the create flow are the only things that distinguish the
  // two entry points — Stripe sees one kind of session from both.
  await reportServerEvent('checkout_started', {
    event_id: event.id,
    source: 'settings',
    currency: event.locale === 'en' ? 'usd' : 'huf',
    locale: event.locale === 'en' ? 'en' : 'hu',
  })

  // Outside the try on purpose: redirect() signals by throwing, so catching
  // around it would swallow the navigation and report a failure instead.
  redirect(checkoutUrl)
}

/** Every way this action can end without a Checkout Session existing. */
function blocked(
  eventId: string | null,
  reason: ServerEventProperties['checkout_blocked']['reason'],
) {
  return reportServerEvent('checkout_blocked', {
    event_id: eventId,
    source: 'settings',
    reason,
  })
}
