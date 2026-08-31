# Auth emails

Production auth email is rendered by the signed Supabase **Send Email Hook** at
`POST /api/auth/send-email`. It reads `lang=en|hu` from the auth redirect URL
(then user metadata, then the Hungarian legacy default) and sends exactly one
language through Resend.

`magic-link.html` and `confirm-signup.html` are English-only local-development
fallbacks used by `supabase start` and visible in Inbucket at
http://127.0.0.1:54324. Static Supabase templates cannot select a locale; do not
push them to production in place of the hook.

## Production setup

1. Generate a Standard Webhooks secret. Keep the complete value Supabase shows
   (`v1,whsec_…`).
2. Add these environment variables to the production deployment:

   ```bash
   SEND_EMAIL_HOOK_SECRET=v1,whsec_…
   RESEND_API_KEY=re_…
   AUTH_EMAIL_FROM="OurFilm <noreply@ourfilm.app>" # optional override
   ```

   `NEXT_PUBLIC_SUPABASE_URL` is already required by the app. The sender domain
   must be verified in Resend.

3. Deploy the app, then configure **Supabase Dashboard → Authentication → Hooks
   → Send Email**:

   - URL: `https://ourfilm.app/api/auth/send-email`
   - Secret: the same `SEND_EMAIL_HOOK_SECRET`

4. Test both a never-used address (signup) and an existing host (magic link) in
   both `/en` and `/hu` flows. Each message must contain only the selected
   language.

The endpoint verifies the Standard Webhooks signature before reading the
payload and forwards Supabase's webhook ID to Resend as an idempotency key, so
hook retries cannot duplicate a successful message.

## The hook does not lift the email rate limit

GoTrue applies its email rate limiter **before** it calls the hook, so routing
delivery through Resend does not exempt the project from it. Two separate
limits both answer `429 over_email_send_rate_limit`:

- **A 60-second gap between links to the same address** (`max_frequency`). The
  message names the seconds it still wants, so it is recognisable on sight.
- **A project-wide hourly cap on auth emails**, Authentication → Rate Limits →
  "Rate limit for sending emails", whose message is a flat
  `email rate limit exceeded`. It sits at **2/hour** — for every host combined,
  which is roughly one sign-in and one retry for the entire product — and
  Supabase only makes the field editable once **custom SMTP** is configured.
  An enabled Send Email Hook does **not** unlock it: the hook replaces
  delivery, not the limiter in front of it.

So production needs Resend configured **twice**: as the hook (which sends and
picks the language) and as custom SMTP under Authentication → Emails
(`smtp.resend.com`, user `resend`, password the API key), whose only job is to
unlock the number. Until then the cap is two auth emails an hour.

`lib/auth-link.ts` maps a 429 to a message that says to wait, rather than to the
generic "could not send" that invites more tapping.

## Locale contract

Both `signInWithOtp` callers add the locale in two places:

- `lang` on `emailRedirectTo`, authoritative for that request;
- `user_metadata.locale`, a fallback for older callers.

The hook also understands the previous format where `lang` appeared only in
the nested `next` URL. Accounts with no locale signal default to Hungarian to
preserve the behavior of the original Hungarian-only product.
