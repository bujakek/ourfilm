import 'server-only'

import { cache } from 'react'

import type { Database } from './supabase/database.types'
import { createClient } from './supabase/server'

export type PurchaseStatus = Database['public']['Enums']['purchase_status']
export type Purchase = Database['public']['Tables']['purchases']['Row']

/**
 * Stripe takes amounts in a currency's minor unit. HUF is one of the awkward
 * ones: it is *presented* as a zero-decimal currency (nobody prices a wedding
 * album at 9 900,00 Ft) but the API still expects minor units, and additionally
 * requires the amount to divide evenly by 100. So 9 900 Ft is `990000`.
 *
 * Getting this wrong is a factor-of-100 error in either direction, which is
 * the kind of bug that either charges nothing or charges a fortune, so the
 * conversion lives here and nowhere else.
 */
export const HUF_MINOR_PER_FORINT = 100

const HUF = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
})

/** Formats what Stripe reported for display: `990000` → `9 900 Ft`. */
export function formatAmount(
  amountMinor: number | null,
  currency: string | null,
): string | null {
  if (amountMinor === null) return null
  // English events are sold in USD. Keep non-HUF ledger entries explicit
  // rather than accidentally formatting them as forints.
  if (currency && currency.toLowerCase() !== 'huf') {
    return `${amountMinor / 100} ${currency.toUpperCase()}`
  }
  return HUF.format(amountMinor / HUF_MINOR_PER_FORINT)
}

export type EventQuota = {
  /** How many distinct participants the free tier allows per event. */
  participantLimit: number
  /** How many have joined so far. */
  participantCount: number
  /** True when the event is paid for, or owned by an admin. */
  unlimited: boolean
}

/**
 * How much room is left in an event.
 *
 * The free tier is a **participant** cap, not a photo cap. That is the whole
 * commercial shape of the disposable camera: every guest gets the host's chosen
 * roll of 5/10/16/24/36 frames whether or not the event is paid for, and what
 * paying buys is more guests. Five friends shooting 36 frames each is a
 * legitimately free event; the sixth guest is what asks for money.
 *
 * Host-only, unlike the photo quota it replaces. A guest turned away by the cap
 * is deliberately not shown a checkout — a wedding guest holding a phone is not
 * the person who can fix it, and asking them to pay for the couple's album is
 * the wrong sentence to put on that screen. `event_participant_quota` is
 * granted to `authenticated` only.
 */
export const getEventQuota = cache(
  async (eventId: string): Promise<EventQuota> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .rpc('event_participant_quota', { p_event_id: eventId })
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Az esemény kvótája nem elérhető.')

    return {
      participantLimit: data.participant_limit,
      participantCount: data.participant_count,
      unlimited: data.unlimited,
    }
  },
)

/**
 * The purchase record that best describes an event's billing state.
 *
 * RLS scopes this to the host's own events (and everything, for an admin), so
 * an empty result means "not yours or not bought" — the same answer either
 * way, exactly as with `getOwnedEventBySlug`.
 *
 * Ordered by `paid_at` before `created_at`, which is not the obvious choice
 * and matters. Open or unreconciled checkouts are `pending`; Stripe later turns
 * abandoned and delayed-failure attempts into `expired` or `failed` rows. Those
 * outcomes are kept on purpose as a ledger. Newest-first could surface one of
 * them over the payment that actually went through and report a paid album as
 * unpaid. Only settled rows carry a `paid_at`, so sorting on it puts real
 * outcomes first and leaves attempts where they belong.
 *
 * This is for showing the host what happened. Whether the cap is lifted is not
 * decided here — `getEventQuota().unlimited` is, because it also answers the
 * admin-owned case that no purchase row will ever describe. And neither is what
 * the *database* enforces: `event_is_full_plan()` re-derives it inside
 * `join_event`, so a client that could somehow lie about this would still be
 * refused the sixth participant.
 */
export const getEventPurchase = cache(
  async (eventId: string): Promise<Purchase | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('event_id', eventId)
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  },
)
