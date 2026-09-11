/**
 * What a host is called, and what counts as a usable name.
 *
 * Client-safe on purpose, and that is the whole reason this is not in
 * `lib/host-profile.ts`: that module is `server-only` because it reads the
 * database, and the account form is a Client Component that needs to validate
 * as the host types and draw their initials before anything is saved. Same
 * split as `lib/pricing.ts` against `lib/billing.ts`, for the same reason.
 *
 * Nothing here touches Supabase. The database enforces the same 2–40 range in
 * `profiles_display_name_valid`; these are the copy-bearing half, so a host is
 * told what is wrong instead of meeting a constraint violation.
 */

export const HOST_DISPLAY_NAME_MAX_LENGTH = 40
export const HOST_DISPLAY_NAME_MIN_LENGTH = 2

export type HostDisplayNameProblem =
  'required' | 'too_short' | 'too_long' | null

export function hostDisplayNameProblem(name: string): HostDisplayNameProblem {
  const length = name.trim().length
  if (length === 0) return 'required'
  if (length < HOST_DISPLAY_NAME_MIN_LENGTH) return 'too_short'
  if (length > HOST_DISPLAY_NAME_MAX_LENGTH) return 'too_long'
  return null
}

/**
 * What a host's photos are credited to.
 *
 * Existing accounts predate `profiles.display_name`, so null still has to be
 * useful. The local part is the same privacy-preserving fallback host capture
 * used before the account page existed: it identifies the organiser without
 * publishing an email address in the gallery or the ZIP filename — where
 * `archiveEntryName` collapses `[^\p{L}\p{N}]+`, so a whole address would be
 * stamped on the couple's archive for ever as `anna-kovacs-hu`.
 */
export function hostDisplayName(
  email: string | null | undefined,
  savedName: string | null | undefined,
): string {
  const saved = savedName?.trim()
  if (saved) return saved

  const local = (email ?? '').split('@')[0]?.trim()
  return local || 'Host'
}

export function hostInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean)

  if (parts.length === 0) return 'OF'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''
  return `${first}${last || first}`.toLocaleUpperCase('hu-HU')
}
