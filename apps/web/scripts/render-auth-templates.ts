/**
 * Write the static local-stack auth templates from the real renderer.
 *
 *   pnpm --filter web templates:render
 *
 * `supabase/templates/*.html` are what `supabase start` sends to the local
 * Mailpit, since a static Supabase template cannot select a locale and the
 * production hook (`/api/auth/send-email`) is what actually renders mail. They
 * used to be hand-authored copies of the hook's output and drifted from it the
 * moment the design moved on. Now they are the hook's own English output with
 * Supabase's `{{ .ConfirmationURL }}` placeholder where the link goes, so the
 * two cannot disagree. Re-run after touching `lib/auth-email.ts` or
 * `lib/email/layout.ts`, and commit the result.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderAuthEmail } from '../lib/auth-email.ts'

const here = dirname(fileURLToPath(import.meta.url))
const templates = join(here, '..', '..', '..', 'supabase', 'templates')

const PLACEHOLDER = '{{ .ConfirmationURL }}'

const files: Record<string, Parameters<typeof renderAuthEmail>[0]['action']> = {
  'magic-link.html': 'magiclink',
  'confirm-signup.html': 'signup',
}

for (const [file, action] of Object.entries(files)) {
  const { html } = renderAuthEmail({
    locale: 'en',
    action,
    confirmationUrl: PLACEHOLDER,
  })
  // The renderer escapes the URL for HTML, which turns nothing in the
  // placeholder into an entity; asserted rather than assumed.
  if (!html.includes(`href="${PLACEHOLDER}"`)) {
    throw new Error(`Placeholder did not survive rendering in ${file}`)
  }
  writeFileSync(join(templates, file), html)
  console.log(`wrote supabase/templates/${file}`)
}
