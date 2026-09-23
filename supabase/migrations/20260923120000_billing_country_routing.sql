-- The billing country decides how an event is sold; the interface language no
-- longer does.
--
-- Until now `purchases.settlement` was derived from `events.locale`: Hungarian
-- events were direct sales invoiced through Billingo, English ones went
-- through Stripe Managed Payments. From here the host confirms a billing
-- country before Checkout, the server derives the settlement from it
-- (`lib/settlement.ts`), and this row records both — so a later language
-- switch or profile edit cannot reclassify a sale that already exists.
--
-- Additive only. Every existing row keeps its settlement, which was recorded
-- when it was sold; nothing here reinterprets one. Rows from before this
-- migration simply have no selected country, and nothing treats that absence
-- as evidence of a direct sale.

alter table public.purchases
  -- What the host confirmed on our page before Checkout was created. The
  -- routing input, frozen with the Session it produced.
  add column selected_billing_country text,
  -- What Stripe reported after payment (`customer_details.address.country`).
  -- Only the country: the full address of a direct sale is already kept in
  -- the invoice snapshot, and a managed sale's address is Link's business.
  add column reported_billing_country text,
  -- Set when a paid sale cannot be classified or invoiced without a human:
  -- the buyer crossed the HU/non-HU boundary inside Stripe's page, the
  -- ledger and Stripe disagree about Managed Payments, or a legacy Session
  -- carries nothing to classify it by. The payment stands and the album
  -- stays unlocked; only automatic invoicing stops.
  add column reconciliation_reason text,
  add column reconciliation_flagged_at timestamptz,
  add constraint purchases_selected_billing_country_check
    check (
      selected_billing_country is null
      or selected_billing_country ~ '^[A-Z]{2}$'
    ),
  add constraint purchases_reported_billing_country_check
    check (
      reported_billing_country is null
      or reported_billing_country ~ '^[A-Z]{2}$'
    ),
  add constraint purchases_reconciliation_reason_check
    check (
      reconciliation_reason is null
      or reconciliation_reason in (
        'billing_country_mismatch',
        'unsupported_billing_country',
        'settlement_mismatch',
        'settlement_unverified'
      )
    ),
  -- A direct sale is a Hungarian sale. The other direction is not enforced:
  -- while `OURFILM_HU_DIRECT` is off a Hungarian buyer settles through
  -- Managed Payments, exactly as before.
  add constraint purchases_direct_is_domestic_check
    check (
      settlement <> 'direct'
      or selected_billing_country is null
      or selected_billing_country = 'HU'
    );

-- Where the queue for a human lives. Partial, because a flag is rare.
create index purchases_reconciliation_idx
  on public.purchases (reconciliation_flagged_at)
  where reconciliation_reason is not null;

-- The host's own insert may now carry the country they confirmed, and still
-- nothing that only Stripe or the webhook may write.
drop policy "host records own pending purchase" on public.purchases;
create policy "host records own pending purchase"
  on public.purchases for insert to authenticated
  with check (
    status = 'pending'
    and owner_id = auth.uid()
    and invoice_status = 'not_started'
    and invoice_attempts = 0
    and billing_type is null
    and billing_name is null
    and billing_email is null
    and billing_country_code is null
    and billing_post_code is null
    and billing_city is null
    and billing_address is null
    and billing_tax_number is null
    and terms_version is null
    and terms_accepted_at is null
    and early_performance_consent_at is null
    and billingo_partner_id is null
    and billingo_document_id is null
    and billingo_invoice_number is null
    and billingo_cancellation_document_id is null
    and invoice_issued_at is null
    and invoice_sent_at is null
    and invoice_cancelled_at is null
    and reported_billing_country is null
    and reconciliation_reason is null
    and reconciliation_flagged_at is null
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.owner_id = auth.uid()
    )
  );

-- A flagged purchase is never invoiced automatically. Issuing a Hungarian
-- invoice is irreversible — it can only be cancelled — so a sale whose buyer
-- or arrangement is in doubt waits for a person rather than for the sweep.
create or replace function public.claim_purchase_invoice(p_purchase_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  update public.purchases
  set invoice_status = 'processing',
      invoice_attempts = invoice_attempts + 1,
      invoice_last_error = null,
      invoice_next_attempt_at = null,
      invoicing_started_at = now()
  where id = p_purchase_id
    and status = 'paid'
    and settlement = 'direct'
    and reconciliation_reason is null
    and (
      invoice_status in ('pending', 'send_failed', 'failed', 'blocked')
      or (
        invoice_status = 'processing'
        and invoicing_started_at < now() - interval '5 minutes'
      )
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_purchase_invoice(uuid) from public;
revoke all on function public.claim_purchase_invoice(uuid) from anon, authenticated;
grant execute on function public.claim_purchase_invoice(uuid) to service_role;
