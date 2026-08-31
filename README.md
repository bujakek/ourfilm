# OurFilm

OurFilm is a mobile-first digital disposable camera for events. A host creates
an event and shares its QR code; guests join in the browser, receive a fixed
roll of shots, and take photos without installing an app or creating an account.
Photos are revealed according to the host’s settings and can be moderated and
downloaded by the host.

The product supports English and Hungarian. Public pages live under `/en` and
`/hu`; event language is stored with each event and is carried by guest, QR and
share URLs.

## Stack

- Next.js 16, React 19, strict TypeScript, Tailwind CSS v4
- Supabase Postgres, Auth and private Storage
- Stripe Managed Payments / Link as Merchant of Record
- Resend-backed transactional email through Supabase Auth
- Vercel hosting and Web Analytics

## Local development

```bash
pnpm install
pnpm dev
```

Copy the required environment variables into `.env.local` (never commit it):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_EVENT=

# Transactional email
RESEND_API_KEY=
LEGAL_EMAIL_FROM=
SEND_EMAIL_HOOK_SECRET=         # Supabase Authentication → Hooks → Send Email
AUTH_EMAIL_FROM=                # optional; defaults to OurFilm <noreply@ourfilm.app>

# Emergency upload controls
OURFILM_UPLOADS_DISABLED=false
OURFILM_EVENT_STORAGE_LIMIT_BYTES=
```

`OURFILM_UPLOADS_DISABLED=true` pauses new photo reservations globally without
affecting existing galleries. `OURFILM_EVENT_STORAGE_LIMIT_BYTES`, when set to a
positive integer, pauses new reservations for an event after its ready master
photos reach that many bytes.

Production auth messages use the signed endpoint at `/api/auth/send-email`,
which selects English or Hungarian from the individual login request and sends
one language through Resend. Deployment and Supabase hook setup are documented
in `supabase/templates/README.md`.

## Important routes

- `/en`, `/hu` — marketing site
- `/host/events/new?lang=en|hu` — event creation
- `/host` — host dashboard
- `/host/events/[slug]` — QR, sharing, photos and event overview
- `/e/[slug]?lang=en|hu` — guest camera and gallery
- `/en/terms`, `/en/privacy`, `/en/legal` — English legal pages
- `/hu/aszf`, `/hu/adatvedelem`, `/hu/impresszum` — Hungarian legal pages

## Verification

```bash
pnpm format
pnpm verify
```

Database tests use the linked remote project and mutate temporary data, so run
`pnpm test:db` deliberately after applying migrations. Migrations are
append-only and guest writes remain service-role-only server actions/RPCs.

See `CLAUDE.md` for architecture decisions, security boundaries and operational
notes.
