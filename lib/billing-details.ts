import { z } from 'zod'

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
 * Parses the invoice address before a Stripe session can be created.
 *
 * The pilot sells in Hungary only. Keeping the country fixed is deliberate:
 * accepting a foreign billing address would make VAT treatment a business
 * decision, not a harmless extra option in this form.
 */
export function parseBillingDetails(formData: FormData): BillingDetailsResult {
  const type =
    formData.get('billing_type') === 'company' ? 'company' : 'individual'

  const parsed = billingDetailsSchema.safeParse({
    type,
    name: String(formData.get('billing_name') ?? ''),
    email: String(formData.get('billing_email') ?? ''),
    countryCode: 'HU',
    postCode: String(formData.get('billing_post_code') ?? ''),
    city: String(formData.get('billing_city') ?? ''),
    address: String(formData.get('billing_address') ?? ''),
    taxNumber:
      type === 'company'
        ? String(formData.get('billing_tax_number') ?? '')
        : null,
  })

  if (parsed.success) return { success: true, data: parsed.data }

  const field = parsed.error.issues[0]?.path[0]
  const messages: Record<string, string> = {
    name: 'Add meg a számlán szereplő nevet.',
    email: 'Adj meg egy érvényes e-mail-címet.',
    postCode: 'Adj meg egy négyjegyű magyar irányítószámot.',
    city: 'Add meg a települést.',
    address: 'Add meg a közterületet és a házszámot.',
    taxNumber: 'Add meg a teljes magyar adószámot, például 12345678-1-42.',
  }

  return {
    success: false,
    error: messages[String(field)] ?? 'Ellenőrizd a számlázási adatokat.',
  }
}
