'use server'

import { getEventQuota } from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { createEventCheckoutUrl } from '@/lib/stripe/checkout'
import { stripeIsConfigured } from '@/lib/stripe/env'
import { createClient } from '@/lib/supabase/server'
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
  if (!slug) return { error: 'Hiányzó esemény.' }

  if (!stripeIsConfigured()) {
    return {
      error:
        'A fizetés még nincs beállítva. Szólj nekünk, és elintézzük — addig ' +
        'az album és a feltöltés változatlanul működik.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Lejárt a munkameneted. Lépj be újra.' }

  // Null covers both "no such event" and "not yours" — RLS makes them the same
  // answer, which is the correct one to give either way.
  const event = await getOwnedEventBySlug(slug)
  if (!event) return { error: 'Nincs ilyen esemény.' }

  // The ledger deliberately has no unique index stopping a second paid row, so
  // this is the check that stops a host paying twice for the same album. It
  // reads the database predicate rather than a purchase row, so an
  // admin-owned event is correctly reported as already unlimited.
  const quota = await getEventQuota(event.id)
  if (quota.unlimited) {
    return { error: 'Ez az esemény már korlátlan — nincs mit fizetni.' }
  }

  let checkoutUrl: string
  try {
    checkoutUrl = await createEventCheckoutUrl({
      eventId: event.id,
      slug: event.slug,
      ownerId: user.id,
      ownerEmail: user.email ?? null,
    })
  } catch (e) {
    console.error('Stripe checkout session failed', e)
    return { error: 'Nem sikerült elindítani a fizetést. Próbáld újra.' }
  }

  // Outside the try on purpose: redirect() signals by throwing, so catching
  // around it would swallow the navigation and report a failure instead.
  redirect(checkoutUrl)
}
