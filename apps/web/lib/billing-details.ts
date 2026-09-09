import { z } from 'zod'
import type Stripe from 'stripe'

export const BILLING_TYPES = ['individual', 'company'] as const
export type BillingType = (typeof BILLING_TYPES)[number]

const HUNGARIAN_TAX_NUMBER = /^\d{8}-\d-\d{2}$/

const billingDetailsSchema = z
  .object({
    type: z.enum(BILLING_TYPES),
    name: z.string().trim().min(2).max(160),
    email: z.email().trim().max(254),
    countryCode: z.literal('HU'),
    postCode: z
      .string()
      .trim()
      .regex(/^\d{4}$/),
    city: z.string().trim().min(2).max(100),
    address: z.string().trim().min(3).max(200),
    taxNumber: z.string().trim().max(13).nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.type === 'company' &&
      !HUNGARIAN_TAX_NUMBER.test(value.taxNumber ?? '')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['taxNumber'],
        message: 'Add meg a teljes magyar adószámot.',
      })
    }
  })

export type BillingDetails = z.infer<typeof billingDetailsSchema>

export type BillingDetailsResult =
  { success: true; data: BillingDetails } | { success: false; error: string }

/**
 * Builds the immutable invoice snapshot from a paid Stripe Checkout Session.
 *
 * A Hungarian invoice must carry the buyer's name and address even when the
 * buyer is a private individual, so the direct checkout collects them on
 * Stripe's hosted page rather than in a second OurFilm form — which is also
 * what lets an Apple Pay customer supply them from the wallet.
 *
 * Snapshot, not a reference: what is invoiced is what the buyer entered at the
 * moment they paid, and a later edit anywhere must not rewrite an issued
 * document.
 *
 * `type` is only ever `'company'` when Stripe returned a Hungarian tax id, and
 * `tax_id_collection` is deliberately off for now — so today this always
 * resolves to `'individual'`. The company branch stays because turning that
 * flag on is a one-line change.
 */
export function billingDetailsFromStripeSession(
  session: Stripe.Checkout.Session,
): BillingDetailsResult {
  const customer = session.customer_details
  const address = customer?.address
  const hungarianTaxId = customer?.tax_ids?.find(
    (taxId) => taxId.type === 'hu_tin',
  )
  const taxNumber = hungarianTaxId?.value
    ? normalizeHungarianTaxNumber(hungarianTaxId.value)
    : null
  const type: BillingType = taxNumber ? 'company' : 'individual'

  const parsed = billingDetailsSchema.safeParse({
    type,
    name:
      (type === 'company' ? customer?.business_name : null) ??
      customer?.individual_name ??
      customer?.name ??
      '',
    email: customer?.email ?? session.customer_email ?? '',
    countryCode: address?.country ?? '',
    postCode: address?.postal_code ?? '',
    city: address?.city ?? '',
    address: [address?.line1, address?.line2].filter(Boolean).join(', '),
    taxNumber,
  })

  if (parsed.success) return { success: true, data: parsed.data }

  const field = parsed.error.issues[0]?.path[0]
  const messages: Record<string, string> = {
    name: 'Add meg a számlán szereplő nevet.',
    email: 'Adj meg egy érvényes e-mail-címet.',
    countryCode: 'A számlázási cím csak magyarországi lehet.',
    postCode: 'Adj meg egy négyjegyű magyar irányítószámot.',
    city: 'Add meg a települést.',
    address: 'Add meg a közterületet és a házszámot.',
    taxNumber: 'Add meg a teljes magyar adószámot, például 12345678-1-42.',
  }

  return {
    success: false,
    error:
      messages[String(field)] ??
      `A Stripe Checkout hiányos vagy nem magyar számlázási adatokat adott vissza (${String(field ?? 'unknown')}).`,
  }
}

function normalizeHungarianTaxNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 8)}-${digits.slice(8, 9)}-${digits.slice(9)}`
  }
  return value.trim()
}
