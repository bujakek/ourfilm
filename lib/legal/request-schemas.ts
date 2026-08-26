import { z } from 'zod'

/**
 * What the two legal forms accept, as schemas rather than as `if` statements.
 *
 * Split out of `lib/legal/requests.ts` for one reason: that module is
 * `server-only` — it holds the service-role client — and validation rules that
 * decide whether a legal declaration is recorded are exactly the thing that
 * should be testable without a database. The unit suite imports this file; the
 * server module imports it too, so there is one set of rules.
 *
 * Everything is capped and trimmed. These are open forms on the public
 * internet, and the fields end up in a table an operator reads: an unbounded
 * `reason` is a denial-of-service on the person doing the reading as much as
 * on the database.
 */

const MAX_SHORT = 200
const MAX_LONG = 4000

/** Trim, collapse the whitespace a paste brings, and cap the length. */
const text = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max))

/** Multi-line fields keep their newlines; only the length is capped. */
const paragraph = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(max))

export const withdrawalSchema = z.object({
  fullName: text(MAX_SHORT),
  orderReference: text(MAX_SHORT),
  email: z.email().max(MAX_SHORT),
  note: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(MAX_LONG))
    .optional(),
})

export const reportSchema = z.object({
  reporterName: text(MAX_SHORT),
  reporterEmail: z.email().max(MAX_SHORT),
  eventReference: text(MAX_SHORT),
  contentReference: paragraph(MAX_LONG),
  reason: paragraph(MAX_LONG),
  legalBasis: paragraph(MAX_LONG),
  goodFaith: z.literal(true),
})
