/**
 * Push the branded auth email templates to the linked Supabase project.
 *
 *   pnpm emails:push            # show what would change
 *   pnpm emails:push --check    # read the remote back and diff it (read-only)
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
 *
 * --check is the one to reach for when a host reports a stock Supabase email:
 * it GETs the live auth config and says, per template, whether the remote is
 * byte-identical to this repo. Nothing here can tell you that otherwise — a
 * green --apply from months ago is not evidence about today's project, and the
 * dashboard shows the two templates on separate tabs, so branding Magic Link
 * and leaving Confirm signup stock looks finished from either one.
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
const check = process.argv.includes('--check')

/** --check and --apply need the token; the bare dry run does not, so it still
 *  works on a fresh clone with nothing but the repo. */
function accessToken(): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'Missing SUPABASE_ACCESS_TOKEN. Create one at ' +
        'https://supabase.com/dashboard/account/tokens and pass it inline:\n' +
        '  SUPABASE_ACCESS_TOKEN=sbp_… pnpm emails:push --check',
    )
  }

  // The two credentials are easy to mix up and the API's own answer to the
  // wrong one is "JWT could not be decoded", which reads like a corrupt token
  // rather than the wrong kind of token. A project key (`sb_secret_…`,
  // `sb_publishable_…`, or a legacy service_role JWT) talks to *your project*;
  // api.supabase.com only accepts an account-wide personal access token, and
  // that one is under Account → Access Tokens, not project settings.
  if (!token.startsWith('sbp_')) {
    throw new Error(
      `SUPABASE_ACCESS_TOKEN is a ${token.startsWith('sb_') || token.startsWith('ey') ? 'project key' : 'token of an unrecognised kind'}, not a personal access token.\n` +
        'The Management API needs an account-wide token beginning `sbp_`, from\n' +
        'https://supabase.com/dashboard/account/tokens — project keys do not work here.',
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

/** Print, per template, whether the live config matches this repo. Shared by
 *  --check (a GET) and --apply (the PATCH's own response body), because the
 *  question is identical and the two answers must never be phrased differently. */
function report(
  live: Record<string, unknown>,
  body: Record<string, string>,
): boolean {
  let ok = true
  for (const t of TEMPLATES) {
    const contentMatches = live[t.contentField] === body[t.contentField]
    const subjectMatches = live[t.subjectField] === body[t.subjectField]
    ok &&= contentMatches && subjectMatches

    console.log(`\n${t.label}`)
    console.log(
      `  content: ${contentMatches ? 'matches this repo ✓' : 'DIFFERS ✗'}` +
        (contentMatches
          ? ''
          : `  (remote is ${describe(live[t.contentField])})`),
    )
    console.log(
      `  subject: ${subjectMatches ? 'matches this repo ✓' : `DIFFERS ✗  (remote: ${JSON.stringify(live[t.subjectField])})`}`,
    )
  }
  return ok
}

/** A stock Supabase template is recognisable on sight, and saying so is worth
 *  more than a byte count when someone is staring at a failing login email. */
function describe(value: unknown): string {
  if (value == null) return 'unset — Supabase serves its built-in default'
  if (typeof value !== 'string') return `a ${typeof value}`
  if (/<h2>(Magic Link|Confirm your signup)<\/h2>/i.test(value)) {
    return "Supabase's built-in default"
  }
  return `${(value.length / 1024).toFixed(1)} KB of something else`
}

async function authConfig(ref: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  })
  if (!res.ok) {
    throw new Error(
      `Could not read the auth config (${res.status}): ${await res.text()}`,
    )
  }
  return (await res.json()) as Record<string, unknown>
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

  if (check) {
    const live = await authConfig(ref)
    const ok = report(live, body)

    // Two settings decide whether the Confirm signup template is ever reached
    // at all, and both fail silently. With autoconfirm on, a first-time host is
    // created and confirmed without an email; at 2 mails an hour, the second
    // attempt of a mistyped address is simply never sent. Neither shows up as
    // a wrong template, so print them next to the diff.
    console.log(
      `\nmailer_autoconfirm:    ${live.mailer_autoconfirm}` +
        (live.mailer_autoconfirm
          ? '  ← first-time hosts get NO confirmation email at all'
          : ''),
    )
    console.log(`rate_limit_email_sent: ${live.rate_limit_email_sent} per hour`)
    console.log(
      `smtp_host:             ${live.smtp_host ?? 'unset — Supabase’s shared sender, 2/hour hard cap'}`,
    )

    console.log(
      ok
        ? '\nBoth templates on the remote match this repo.'
        : '\nThe remote does NOT match this repo. Re-run with --apply.',
    )
    if (!ok) process.exitCode = 1
    return
  }

  if (!apply) {
    console.log(
      '\nDry run — nothing sent. Re-run with --check to compare ' +
        'against the live project, or --apply to send it.',
    )
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
  if (!report(after, body)) {
    throw new Error(
      'At least one template did not come back as sent. Check the dashboard ' +
        '(Authentication → Emails) before assuming hosts are getting it.',
    )
  }
  console.log('\nBoth templates are live on the remote project.')
}

await main()
