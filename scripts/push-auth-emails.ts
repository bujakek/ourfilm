/**
 * Push the branded auth email templates to the linked Supabase project.
 *
 *   pnpm emails:push            # show what would change
 *   pnpm emails:push --apply    # send it
 *
 * Why this and not `supabase config push`: that command sends this repo's
 * *entire* config.toml to the remote, and it has no --dry-run. The auth
 * section here is otherwise stock, so it would set production's site_url to
 * http://127.0.0.1:3000 and drop the Resend SMTP block along the way. The
 * Management API's auth config endpoint is a partial update — only the fields
 * in the body change — so sending exactly four mailer fields cannot touch
 * anything else.
 *
 * Needs a personal access token (sbp_…) from
 * https://supabase.com/dashboard/account/tokens, as SUPABASE_ACCESS_TOKEN.
 * It is not in .env.local and should not be: it is an account-wide credential,
 * far broader than the project keys that file holds.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_… pnpm emails:push --apply
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const API = 'https://api.supabase.com'

/** The four fields this script is allowed to write. Nothing else. */
const TEMPLATES = [
  {
    file: 'magic-link.html',
    subjectField: 'mailer_subjects_magic_link',
    contentField: 'mailer_templates_magic_link_content',
    subject: 'Belépési linked az OurFilmhez',
    label: 'Magic Link (returning host)',
  },
  {
    file: 'confirm-signup.html',
    subjectField: 'mailer_subjects_confirmation',
    contentField: 'mailer_templates_confirmation_content',
    subject: 'Erősítsd meg az e-mail-címed — OurFilm',
    label: 'Confirm signup (first-time host)',
  },
] as const

const apply = process.argv.includes('--apply')

/** Only --apply needs the token: a dry run should work on a fresh clone with
 *  nothing but the repo. */
function accessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'Missing SUPABASE_ACCESS_TOKEN. Create one at ' +
        'https://supabase.com/dashboard/account/tokens and pass it inline:\n' +
        '  SUPABASE_ACCESS_TOKEN=sbp_… pnpm emails:push --apply',
    )
  }
  return token
}

/** Derived from the project URL rather than asked for, so it cannot point at
 *  someone else's project by typo. `supabase/.temp/project-ref` would work too
 *  but is gitignored and absent on a fresh clone. */
function projectRef(): string {
  const override = process.env.SUPABASE_PROJECT_REF
  if (override) return override

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL — run through pnpm so .env.local is loaded.',
    )
  }
  const ref = new URL(url).hostname.split('.')[0]
  if (!ref || ref.length < 15) {
    throw new Error(`Could not read a project ref out of ${url}`)
  }
  return ref
}

async function main() {
  const ref = projectRef()
  const dir = path.join(import.meta.dirname, '..', 'supabase', 'templates')

  const body: Record<string, string> = {}
  for (const t of TEMPLATES) {
    const html = await readFile(path.join(dir, t.file), 'utf8')

    // A template that renders but links nowhere looks perfect in a preview and
    // is a dead login link in an inbox. Cheap to check, so check.
    if (!html.includes('{{ .ConfirmationURL }}')) {
      throw new Error(
        `${t.file} has no {{ .ConfirmationURL }} — refusing to push it.`,
      )
    }

    body[t.subjectField] = t.subject
    body[t.contentField] = html
    console.log(
      `${t.label}\n  ${t.file} — ${(html.length / 1024).toFixed(1)} KB\n  subject: ${t.subject}`,
    )
  }

  console.log(`\nProject: ${ref}`)
  console.log(`Fields:  ${Object.keys(body).join(', ')}`)

  if (!apply) {
    console.log('\nDry run — nothing sent. Re-run with --apply.')
    return
  }

  const res = await fetch(`${API}/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(
      `Supabase refused the update (${res.status}): ${await res.text()}`,
    )
  }

  // Read it back rather than trusting the 200. The endpoint accepts unknown
  // fields silently, so a renamed field would look like a successful push and
  // leave the stock template in place.
  const after = (await res.json()) as Record<string, unknown>
  let ok = true
  for (const t of TEMPLATES) {
    const stored = after[t.contentField]
    const matches = stored === body[t.contentField]
    ok &&= matches
    console.log(`\n${t.label}: ${matches ? 'stored ✓' : 'DID NOT STORE ✗'}`)
  }

  if (!ok) {
    throw new Error(
      'At least one template did not come back as sent. Check the dashboard ' +
        '(Authentication → Emails) before assuming hosts are getting it.',
    )
  }
  console.log('\nBoth templates are live on the remote project.')
}

await main()
