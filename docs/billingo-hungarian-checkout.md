# Hungarian checkout: direct Stripe + Billingo

Two arrangements sell the same product, and which one applies is decided by
`events.locale` in exactly one place — `settlementFor()` in
`apps/web/lib/stripe/checkout.ts`.

|                        | English event (`locale: 'en'`)        | Hungarian event (`locale: 'hu'`)           |
| ---------------------- | ------------------------------------- | ------------------------------------------ |
| Session                | `managed_payments: { enabled: true }` | no `managed_payments`                      |
| Price                  | `STRIPE_PRICE_EVENT_USD`, 39 USD      | `STRIPE_PRICE_EVENT`, 12 900 Ft            |
| Seller of record       | Link, LLC                             | **OurFilm**                                |
| Document               | Link issues it                        | **Billingo invoice, AAM**, reported to NAV |
| Billing address        | not collected                         | `billing_address_collection: 'required'`   |
| `purchases.settlement` | `managed`                             | `direct`                                   |

**`OURFILM_HU_DIRECT` is the cutover.** Off — the default, and how this ships
— the Hungarian column above reads exactly like the English one apart from the
Price: Managed Payments, Link as merchant of record, no invoice. Everything in
this document describes the state after it is flipped. What has to be true
first is listed in `apps/web/lib/settlement.ts`, and the honest short version is
that Apple Pay on HUF has to be confirmed on a real device, because without it
the change buys invoicing, NAV reporting and chargeback liability for nothing.

**Why the split exists.** Stripe Managed Payments does not currently do Apple
Pay on HUF, and it works on USD. A QR-code product whose buyers are holding
phones at a wedding cannot give up one-tap payment, so Hungarian events left
Managed Payments — and with it, the invoice became ours to issue.

## What issuing an invoice ourselves brings with it

A Hungarian invoice must carry the buyer's **name and address even when the
buyer is a private individual** (Áfa tv. 169. §), which is why the direct
Checkout Session collects a billing address and the Managed Payments one does
not. It must also be reported to NAV Online Számla; Billingo does that
server-side for `type: 'invoice'` documents, so there is no NAV code here.

The sale is **alanyi adómentes** — matching the `-1-` ÁFA digit of
`COMPANY.taxNumber` — so the invoice line carries `vat: 'AAM'` and the matching
`entitlement`, the 12 900 Ft is the gross and the whole of it, and both
`/hu/aszf` and `/hu/arak` say so. If the exemption threshold is ever crossed,
`lib/billingo/client.ts`, `DIRECT_SALE.vatStatus` and that copy all change in
one commit. **Ask the accountant before the first live forint**, and note that
the threshold concerns the sole trader's whole relevant revenue, not just what
OurFilm has taken.

## How the invoice is made idempotent

An issued Hungarian invoice cannot be withdrawn — only cancelled with a second
(storno) document — so issuing twice is worse than issuing late. Three things
stop it:

1. **`purchases.id` is minted at checkout** and sent to Billingo as
   `vendor_id`. It is the _attempt id_ from `reserve_event_checkout`, not a
   fresh uuid: concurrent callers share one Stripe idempotency key, and Stripe
   refuses a key replayed with different parameters.
2. **Every attempt probes `GET /documents/vendor/{id}` first.** A
   `POST /documents` that timed out may still have created the document; this
   is what finds it instead of making another.
3. **`claim_purchase_invoice` holds a five-minute lease.** The webhook and the
   sweep race constantly, and only one of them may proceed.

The storno path has no vendor probe — Billingo will happily issue a second
storno for the same invoice — so `claim_purchase_invoice_cancellation` is the
only thing standing between two refund deliveries and two cancellations.

## Why the webhook never fails on Billingo

`ensureBillingoInvoice` and `cancelBillingoInvoice` never throw. The payment is
recorded whatever Billingo does; returning 500 would leave
`stripe_webhook_events.processed_at` null and have Stripe re-run the _payment_
handler for three days over an invoicing outage. `/api/invoices/sweep`, driven
by the `invoices-sweep-http` pg_cron job every five minutes, owns the retry —
with exponential backoff capped at an hour, indefinitely. That is deliberate:
there is no attempt cap, because silently dropping an invoice is worse than an
alert that keeps firing.

## Setup

### 1. Billingo profile

1. Use Billingo's separate **API test profile** first. There is no separate
   sandbox host — the same `https://api.billingo.hu/v3` with a test-profile
   key is what test mode means. Test and live ids must never be mixed.
2. Enter the issuer's complete EV details and configure NAV Online Számla in
   the live profile. Verify the connection in Billingo before launch.
3. Create a HUF bank account and an invoice block; record their numeric ids
   (`GET /bank-accounts`, `GET /document-blocks`).
4. Configure the invoice e-mail sender/template and electronic invoicing.
5. Enable a paid Online Számlázó plan (electronic documents need at least
   Basic) **and** the API add-on. Basic API covers 1–50 API documents per
   subscription month, and **cancellations consume documents too**. A 402 from
   Billingo is that allowance running out; it lands as
   `invoice_status = 'blocked'`, which no retry inside the hour can clear.
6. Under **Beállítások → API kulcsok** create a v3 **Olvasás, írás** key.
7. Put the key and both ids in `apps/web/.env.local`:

   ```bash
   BILLINGO_API_KEY=
   BILLINGO_BLOCK_ID=
   BILLINGO_BANK_ACCOUNT_ID=
   # BILLINGO_API_BASE_URL=   # optional; defaults to https://api.billingo.hu/v3
   ```

Without all three, `checkoutIsConfigured('hu')` is false and Hungarian checkout
says payment is not switched on. English checkout is unaffected — that
separation is the point of `lib/checkout-readiness.ts`, and
`tests/unit/checkout-readiness.test.ts` pins it.

### 2. Database

```bash
pnpm supabase migration list        # check, never assume, what is live
pnpm supabase db push --linked
pnpm types:gen && pnpm types:check
```

Run `pnpm test:db` against a **local** stack only.

### 3. Stripe

1. In **Settings → Business → Public details**, a Terms of Service URL is
   **not** required, and the direct path sets no `consent_collection` at all.

   The host accepts the ÁSZF, the privacy notice and the early-performance
   declaration on OurFilm's own billing card before the Session exists —
   `billing-actions` refuses to run without it, and `reserve_event_checkout`
   stamps the canonical `terms_accepted_at` that reaches `purchases`. That
   wording says more than Stripe's box can, and asking a second time would
   gate Stripe's submit, wallet buttons included, which is most of what
   leaving Managed Payments was for.

   Setting the URL anyway is still worth it for the legal-policies dialog
   Checkout offers from its own footer.

2. In **Settings → Payment methods**, keep Cards enabled and confirm Apple Pay
   for HUF. Hosted Checkout surfaces Apple Pay itself; do not hard-code payment
   method types.
3. The webhook destination needs the five types the handler knows:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `charge.refunded`. Each destination has its own `whsec_…`; the one
   `stripe listen` prints is local only.
4. **List before you create** any Price. A duplicate 12 900 Ft product/price
   pair was created here by accident once already.

### 3b. Vercel environment variables

Three `BILLINGO_*` variables, server-only, and they decide whether Hungarian
checkout exists at all. Without them `checkoutIsConfigured('hu')` is false and
the billing card says payment is not switched on — English checkout is
unaffected, which is the whole point of the split in
`lib/checkout-readiness.ts`.

**Scope the Stripe secrets per environment, not "Production and Preview".**
A live `STRIPE_SECRET_KEY` shared with Preview lets every preview URL of every
branch charge a real card, and because Stripe delivers webhooks to
`ourfilm.app` that charge is never reported back: the money moves with no
`paid` row, no unlocked album and no invoice. `stripeIsConfigured()` now
refuses a `sk_live_` key whenever `VERCEL_ENV` says anything but `production`,
so the failure is a switched-off checkout rather than an untraceable payment —
but the variable should still be split. Give Preview `sk_test_` keys, the
matching test-mode Price ids, and the Billingo **test-profile** key.

Vercel requires a redeploy after adding variables; an existing preview keeps
the environment it was built with.

### 4. Vault

The sweep's cron job reads its target and secret from Vault, so it posts
nothing on a local stack:

```sql
select vault.create_secret('https://ourfilm.app', 'ourfilm_api_url');
select vault.create_secret('<EXPORT_WORKER_SECRET>', 'export_worker_secret');
```

`EXPORT_WORKER_SECRET` now guards `/api/invoices/sweep` as well as
`/api/exports/*`. The name is doing double duty; it was not worth a second
secret to rotate.

## Verifying end to end

1. A `locale: 'hu'` event → billing card → checkout. Stripe must ask for a
   billing address and show the ÁSZF checkbox, and Apple Pay must appear on
   HUF. Pay with `4242…`.
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook`. The row
   should reach `status='paid'`, `invoice_status='issued'`, with
   `billingo_document_id` and `billingo_invoice_number` set.
3. The invoice exists in Billingo with `vendor_id` = the purchase uuid, AAM,
   12 900 Ft gross, and the email went out.
4. `stripe events resend` the same event — **no second invoice**.
5. Refund fully in the Dashboard → a storno document, emailed.
6. A `locale: 'en'` event still carries `managed_payments` and creates no
   Billingo document.
7. Unset `BILLINGO_API_KEY`: Hungarian checkout is refused with
   `billingo_not_configured`, English checkout still works.
8. Apple Pay must be tested on a real Apple device with a Hungarian billing
   address in Wallet. A desktop test-card checkout proves nothing about it.

## Operating

- **Alert on** `invoice_failed` (any status), and on a `checkout_settled` with
  `status: 'paid'` that has no matching `invoice_issued` for the same
  `event_id`. Also alert on no `invoice_sweep` for an hour — pg_net never reads
  the response, so the endpoint reporting itself is the only proof the schedule
  is alive.
- **Never hand-write a replacement invoice** without first searching Billingo
  for the purchase uuid as `vendor_id`. A timeout can mean Billingo created the
  invoice even though we never saw the response.
- **Accepted terms are recorded, not required, before invoicing.**
  `consent_collection` makes the checkbox mandatory at Checkout, so a payment
  arriving without it is an anomaly — but the invoice is owed under Hungarian
  law regardless, and withholding it over a missing checkbox would turn a data
  oddity into a legal one. `early_performance_consent_at` stays null and the
  invoice still goes out.
- **The invoiced amount comes from Stripe, not from the ledger row.** The row's
  `amount_minor` is written by the host's own client at checkout; Stripe is the
  authority on what was charged, and that is the number that reaches a document
  carrying our tax number. A disagreement is reported as
  `checkout_amount_mismatch` — nothing ordinary produces one.
- **A non-Hungarian billing address** on a Hungarian event parks the row at
  `invoice_status = 'failed'` and retries hourly, because a Hungarian AAM
  invoice describes a Hungarian sale and accepting a foreign address is a VAT
  decision rather than a UI option. Rare in practice; it needs a human, and the
  repeated `invoice_failed` is how you learn about it.
- **Deleting an event or an account no longer deletes the purchase.** Both
  foreign keys are `on delete set null` and the billing snapshot on the row is
  self-contained, because an accounting record has to outlive the album.
  Establish a yearly deletion process for records whose statutory retention has
  actually elapsed.
- Reconcile Stripe paid/refunded payments against Billingo and NAV regularly.
