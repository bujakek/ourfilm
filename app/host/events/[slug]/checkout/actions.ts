'use server'

import { parseBillingDetails } from '@/lib/billing-details'
import { getEventQuota } from '@/lib/billing'
import { checkoutIsConfigured } from '@/lib/checkout-readiness'
import { getOwnedEventBySlug } from '@/lib/events'
import { createEventCheckoutUrl } from '@/lib/stripe/checkout'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type BillingCheckoutState = { error: string | null }

export async function submitBillingCheckout(
  _previous: BillingCheckoutState,
  formData: FormData,
): Promise<BillingCheckoutState> {
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) return { error: 'Hiányzó esemény.' }

  if (!checkoutIsConfigured()) {
    return {
      error: 'A fizetés és a számlázás még nincs teljesen beállítva.',
    }
  }

  if (
    formData.get('accept_terms') !== 'on' ||
    formData.get('early_performance_consent') !== 'on'
  ) {
    return {
      error: 'A továbblépéshez fogadd el mindkét nyilatkozatot.',
    }
  }

  const parsed = parseBillingDetails(formData)
  if (!parsed.success) return { error: parsed.error }

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
      billingDetails: parsed.data,
    })
  } catch (error) {
    console.error('Stripe checkout session failed', error)
    return { error: 'Nem sikerült elindítani a fizetést. Próbáld újra.' }
  }

  redirect(checkoutUrl)
}
