# Auth email templates

The two emails OurFilm actually sends. Both are the same magic link — the only
difference is whether the address already has an account:

| File                  | Supabase template | Sent to                              |
| --------------------- | ----------------- | ------------------------------------ |
| `magic-link.html`     | Magic Link        | a host who has signed in before      |
| `confirm-signup.html` | Confirm signup    | a host signing in for the first time |

`signInWithOtp({ shouldCreateUser: true })` in `app/host/login/login-form.tsx`
is what sends them, and it picks between the two itself: a new address is signed
up first, and a signup sends the **Confirm signup** template even though the
caller asked for a magic link. Supabase's own docs do not mention this — it is
[discussion #28947](https://github.com/orgs/supabase/discussions/28947).
Branding only the Magic Link template is therefore the bug you will not notice,
because you stop being a new user after your first login. Test the signup one
with an address you have never used.

## Applying them to the linked project

```bash
pnpm emails:push                                    # dry run
SUPABASE_ACCESS_TOKEN=sbp_… pnpm emails:push --apply
```

`scripts/push-auth-emails.ts` PATCHes exactly four fields on
`/v1/projects/{ref}/config/auth` — the two subjects and the two HTML bodies.
That endpoint is a partial update, so nothing else in the project's auth config
can be touched by it, and it reads the templates back afterwards rather than
trusting the 200. The token is an account-wide personal access token from
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens);
pass it inline, don't put it in `.env.local`.

The dashboard route still works if you prefer it — **Authentication → Emails →
Templates** — with these subjects:

| Template       | Subject                                  |
| -------------- | ---------------------------------------- |
| Magic Link     | `Belépési linked az OurFilmhez`          |
| Confirm signup | `Erősítsd meg az e-mail-címed — OurFilm` |

**What not to use: `supabase config push`.** It sends this repo's entire
`config.toml` to the linked project and has no `--dry-run`. The auth section
here is otherwise stock — `site_url` is `http://127.0.0.1:3000`, the redirect
allow-list is a localhost pair, and there is no `[auth.email.smtp]` block at
all — so a push would point production's magic links at a laptop and drop the
Resend SMTP settings. `supabase link` diffs local config against the remote if
you ever want to see how far apart they are.

The `[auth.email.template.*]` entries in `config.toml` are for the local stack
only — `supabase start`, read in Inbucket at http://127.0.0.1:54324.

## Sending

Delivery is Resend over SMTP, set under **Authentication → Emails → SMTP
Settings**: host `smtp.resend.com`, port `465`, username `resend`, password a
Resend API key. Two things to keep straight:

- The **sender address must be on a domain verified in Resend**, and the sender
  email and name are both required fields. Without the verified domain Resend
  rejects the message and the login form shows "Nem sikerült elküldeni".
- **The rate limit does not raise itself.** Supabase's built-in default is 2
  emails per hour, and attaching custom SMTP is what makes it _changeable_, not
  what changes it. Check **Authentication → Rate Limits** and set it
  deliberately — at 2/hour a host who mistypes their address twice is locked
  out for an hour.

## Editing

Email HTML is not web HTML. What these files do deliberately:

- **Tables and inline styles.** The `<style>` block only reaches Apple Mail,
  iOS Mail and Thunderbird — Gmail's apps strip it — so nothing in it may be
  load-bearing. It carries the small-screen tweaks and nothing else.
- **No `backdrop-filter`, no gradients, no webfonts.** The glass surfaces the
  app is built on do not survive an email client. The dark palette is
  reproduced with flat hex fills instead: `#050505` page, `#0b0b0d` card,
  `#c3b6ff` accent, `#f7f7f7` text.
- **A VML pill for the button.** Outlook on Windows renders with Word, which
  knows neither `border-radius` nor padding on an anchor.
- **`{{ .ConfirmationURL }}` appears four times** — the VML button, the real
  anchor, and the copy-paste fallback's href and visible text. Keep all four in
  step; a template that renders but links nowhere looks completely fine in a
  preview.

The templates use `{{ .ConfirmationURL }}`, which is the default PKCE flow the
app already handles (`?code=…`). `app/auth/callback/actions.ts` also accepts
`?token_hash=…&type=magiclink`, so switching to `{{ .TokenHash }}` is possible
without touching the app — it would survive corporate link-scanners that burn
single-use links, at the cost of the same-device requirement the copy currently
states. That is a flow decision, not a design one; leave it alone unless a
scanner actually eats a link.
