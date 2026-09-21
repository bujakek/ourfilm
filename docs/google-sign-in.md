# Google sign-in

The second way into `/host`, beside the magic link. One button on
`/host/login` and one in the onboarding `AuthDialog`; both end at the same
`/auth/callback`, redeem the same way, and land on the same `next`.

Nothing about it is switched on by an environment variable, and that is worth
saying plainly because every other cutover here has one. The provider lives in
Supabase, so the switch is in the Supabase dashboard — `stripeIsConfigured()`
has no counterpart to keep this UI honest, and the button is rendered
unconditionally. **Enable the provider before deploying the button**, or a host
who presses it gets Supabase's own error page rather than one of ours.

## What the code does

| File                                              | Responsibility                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/lib/auth-google.ts`                     | `signInWithOAuth`, wrapped so a refusal is a returned status rather than a throw |
| `apps/web/lib/auth-redirect.ts`                   | The two URLs: where the provider comes back to, and where a failure retries      |
| `apps/web/components/host/google-sign-in.tsx`     | The button, its pending state and its own failure                                |
| `apps/web/app/(product)/auth/callback/actions.ts` | `completeSignIn` — redeems the code and redirects                                |

The callback URL carries three parameters and each one is load-bearing:
`next` (where the host was going — `safeNext`-confined at every hop, so it can
never leave the site), `lang` (the language to fail in; there is no locale
segment under `/auth`), and `provider` (which of the two failures to describe,
`?error=oauth` or `?error=link`).

## Deployment

1. **Google Cloud console** — create an OAuth 2.0 Client ID of type _Web
   application_ on the project that owns the consent screen. Its **Authorized
   redirect URI** is Supabase's callback, never ours:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   The consent screen needs a support email, a privacy policy URL
   (`https://ourfilm.app/hu/adatvedelem`) and a terms URL
   (`https://ourfilm.app/hu/aszf`). Requesting only `email` and `profile`
   keeps it a non-sensitive scope, so no verification review is needed.

2. **Supabase dashboard → Authentication → Sign In / Providers → Google** —
   enable it and paste the client ID and secret. Leave _Skip nonce check_ off:
   it exists for local development, where there is no HTTPS origin.

3. **Supabase dashboard → Authentication → URL Configuration** — the Site URL
   is `https://ourfilm.app`, and **Redirect URLs** must admit the callback
   _with its query string_:

   ```
   https://ourfilm.app/auth/callback**
   https://*.vercel.app/auth/callback**
   ```

   An entry without the glob refuses every real sign-in, because every real
   sign-in carries `next` and `lang`. The second line is what makes previews
   work; drop it if previews should not sign anybody in.

4. **Verify before announcing** — see below. There is no feature flag to turn
   this off again, so the dashboard toggle in step 2 is the rollback.

## Local development

`supabase/config.toml` carries an `[auth.external.google]` block that is
`enabled = false`, so `supabase start` needs no secrets and `pnpm test:db`
is unaffected. To exercise the real button against the local stack, create a
second OAuth client whose authorized redirect URI is
`http://127.0.0.1:54321/auth/v1/callback`, then:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=…
# flip enabled = true in supabase/config.toml, then
pnpm supabase stop && pnpm supabase start
```

`skip_nonce_check` is already `true` in that block — Supabase requires it for
local Google sign-in. Do not copy that setting to production.

## Verification

- `/host/login` offers the Google button above the divider and the email form
  below it; the `?error=oauth` notice appears **above** the divider too.
- Pressing it reaches Google's account chooser, and coming back lands on
  `/host`, signed in.
- Pressing browser Back from Google's chooser releases the button rather than
  leaving it spinning — that is the `pageshow` handler in
  `google-sign-in.tsx`, and bfcache is what makes it necessary.
- Cancelling at Google lands on `/host/login?error=oauth&lang=…&next=…` with
  the Hungarian or English message, and the email form still works.
- From the create flow: fill in the four questions, sign in with Google, and
  confirm the event is created — the draft is in `localStorage` and the round
  trip through Google returns to the same browser, so it must still be there.
- An existing magic link still works; `completeSignIn` handles both shapes.

## Telemetry

Three events, and they are read as a gap as much as a count:

| Event             | Where   | Answers                                                   |
| ----------------- | ------- | --------------------------------------------------------- |
| `sign_in_started` | browser | Which way in a host chose, and from which screen          |
| `sign_in_blocked` | browser | The hand-off never began — the SDK or the network refused |
| `sign_in_settled` | server  | What the callback actually redeemed, or failed to         |

A `google` start with no settle and no block is a host who reached Google's
consent screen and turned back. A rising `sign_in_settled` with
`outcome: failed` on `method: google` is the shape a misconfigured redirect
URL makes, and it is worth an alert for the same reason
`checkout_blocked: stripe_not_configured` is: in production it means a host
was offered a way in that the deployment cannot honor.

None of the three carries an email address, a provider identifier or an error
message. The method is the whole of what is reported.
