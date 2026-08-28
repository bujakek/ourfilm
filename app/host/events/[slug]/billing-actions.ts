'use server'

import { getEventQuota } from '@/lib/billing'
import { getOwnedEventBySlug } from '@/lib/events'
import { createEventCheckoutUrl } from '@/lib/stripe/checkout'
import { checkoutIsConfigured } from '@/lib/checkout-readiness'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type CheckoutState = { error: string | null }

/** Send an event owner straight to hosted Stripe Checkout. */
export async function startEventCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) return { error: 'Hiányzó esemény.' }

  if (!checkoutIsConfigured()) {
    return {
      error:
        'A fizetés még nincs beállítva. Szólj nekünk, és elintézzük — addig az album és a feltöltés változatlanul működik.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Lejárt a munkameneted. Lépj be újra.' }

  const event = await getOwnedEventBySlug(slug)
  if (!event) return { error: 'Nincs ilyen esemény.' }

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
  } catch (error) {
    console.error('Stripe checkout session failed', error)
    return { error: 'Nem sikerült elindítani a fizetést. Próbáld újra.' }
  }

  redirect(checkoutUrl)
}
