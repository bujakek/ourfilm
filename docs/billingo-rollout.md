# Billingo + Stripe rollout

OurFilm sells one HUF 12,900 event package. Checkout is hosted by Stripe;
Billingo issues an AAM electronic invoice only after Stripe reports a settled
payment. A full refund cancels the invoice, while a partial refund keeps both
the invoice and event entitlement unchanged.

## 1. Business and legal prerequisites

- Fill every `TODO` in `lib/company.ts`, verify the Stripe contracting entity,
  then set `hasRealCompanyDetails` to `true` only when the legal pages are safe
  to publish.
- Have the accountant confirm the current AAM status. Its threshold concerns
  the sole trader's total relevant revenue, not just purchases stored by
  OurFilm. The code must not guess when the tax status changes.
- Execute the required data-processing agreements and ensure the published
  privacy notice accurately reflects the enabled providers.

## 2. Billingo test profile

1. Create/select Billingo's separate API test profile. Test-profile documents
   and ids must never be mixed with the live profile.
2. Enter the issuer's complete EV details and configure NAV Online Számla in
   the live profile. Verify the connection in Billingo before launch.
3. Create a HUF bank account and an `OURFILM` invoice block. Record their
   numeric ids from the Billingo v3 API/dashboard.
4. Configure the invoice e-mail sender/template and electronic invoicing.
5. Enable both a paid Online Számlázó plan (electronic documents require at
   least Basic) and the API + Tömeges számlagenerálás add-on. Basic API covers
   1–50 API documents per subscription month; cancellations also consume
   documents, so monitor the allowance.
6. Under **Beállítások → API kulcsok**, create a dedicated v3 **Olvasás, írás**
   key named `OurFilm test`.
7. Put the test profile's key and ids in `.env.local`:

   ```bash
   BILLINGO_API_KEY=
   BILLINGO_BLOCK_ID=
   BILLINGO_BANK_ACCOUNT_ID=
   ```

## 3. Database

After merging the feature branch, apply the new migration to the linked
Supabase project:

```bash
pnpm supabase migration list
pnpm supabase db push --linked
pnpm types:gen
pnpm types:check
pnpm test:db
```

Review and commit any difference produced by `types:gen`. Do not run DB tests
before the migration is present remotely: they use and mutate the linked test
project.

## 4. Stripe test mode

1. Keep the existing one-time HUF Price at `1290000` Stripe minor units, which
   the app verifies and converts to HUF 12,900 for Billingo.
2. Create a deployed webhook destination at
   `https://ourfilm.app/api/stripe/webhook` with only:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
3. Copy that destination's own `whsec_…`; the `stripe listen` secret is local
   and cannot be used on Vercel.
4. Run one individual and one company checkout in Stripe test mode. Verify the
   purchase row, invoice payload/payment date, e-mail delivery, duplicate event
   replay, and a full refund/cancellation. Also force one invalid Billingo
   credential once and verify the Stripe retry finishes the same invoice after
   restoring it.

## 5. Production credentials and Vercel

1. Activate Stripe live mode and create exactly one live one-time HUF Price for
   the same product and amount. Test-mode Price ids do not exist in live mode.
2. In the live Billingo profile create a separate `OurFilm production`
   read-write v3 key and use the live invoice-block and bank-account ids.
3. Add these server-only Production variables in Vercel, keeping test and live
   values in separate scopes:

   ```bash
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   STRIPE_PRICE_EVENT=
   BILLINGO_API_KEY=
   BILLINGO_BLOCK_ID=
   BILLINGO_BANK_ACCOUNT_ID=
   ```

4. Redeploy after saving the variables. Checkout intentionally remains hidden
   if even one required Stripe/Billingo value is absent or malformed.
5. Make one real purchase, inspect its NAV Online Számla status in Billingo,
   confirm the e-mail and payment history, then issue a full Stripe refund and
   confirm the Billingo cancellation document. Keep the `purchases` row and
   Stripe event ids for reconciliation.

## 6. Operating checks

- Alert manually during the pilot on purchase rows whose `invoice_status` is
  `failed`, `send_failed`, `blocked`, or `cancellation_pending`.
- Never create a replacement invoice by hand until searching Billingo for the
  OurFilm purchase UUID (`vendor_id`); an HTTP timeout can mean Billingo created
  the invoice even though OurFilm did not receive the response.
- Reconcile Stripe paid/refunded payments against Billingo and NAV regularly,
  and involve the accountant immediately before the AAM status changes.
- Event/account deletion detaches rather than deletes the self-contained
  purchase and invoice snapshot. Establish a yearly deletion job/process for
  records whose statutory retention period has actually elapsed.
