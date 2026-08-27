-- Billingo invoicing for settled Stripe purchases.
--
-- `purchases` remains the payment ledger. The columns below add the immutable
-- billing snapshot and the state needed to make the external Billingo calls
-- recoverable. A Billingo document is keyed by `purchases.id` through
-- `vendor_id`, so a timeout after document creation can be reconciled instead
-- of producing a second invoice.

create type public.invoice_status as enum (
  'not_started',
  'pending',
  'processing',
  'issued',
  'send_failed',
  'failed',
  'blocked',
  'cancellation_pending',
  'cancelled'
);

alter table public.purchases
  add column billing_type text,
  add column billing_name text,
  add column billing_email text,
  add column billing_country_code text,
  add column billing_post_code text,
  add column billing_city text,
  add column billing_address text,
  add column billing_tax_number text,
  add column terms_version text,
  add column terms_accepted_at timestamptz,
  add column early_performance_consent_at timestamptz,
  add column invoice_status public.invoice_status not null default 'not_started',
  add column invoice_attempts integer not null default 0,
  add column invoice_last_error text,
  add column invoice_next_attempt_at timestamptz,
  add column invoicing_started_at timestamptz,
  add column billingo_partner_id bigint,
  add column billingo_document_id bigint,
  add column billingo_invoice_number text,
  add column invoice_issued_at timestamptz,
  add column invoice_sent_at timestamptz,
  add column billingo_cancellation_document_id bigint,
  add column invoice_cancelled_at timestamptz,
  add constraint purchases_billing_type_check
    check (billing_type is null or billing_type in ('individual', 'company')),
  add constraint purchases_billing_country_check
    check (billing_country_code is null or billing_country_code = 'HU'),
  add constraint purchases_billing_tax_number_check
    check (
      billing_type is null
      or billing_type = 'individual'
      or billing_tax_number ~ '^[0-9]{8}-[0-9]-[0-9]{2}$'
    );

-- Accounting records must survive deletion of the album or host account. The
-- billing snapshot above is self-contained, while nullable references avoid
-- retaining the deleted product/account solely to satisfy a foreign key.
alter table public.purchases
  drop constraint purchases_event_id_fkey,
  drop constraint purchases_owner_id_fkey,
  alter column event_id drop not null,
  alter column owner_id drop not null,
  add constraint purchases_event_id_fkey
    foreign key (event_id) references public.events (id) on delete set null,
  add constraint purchases_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete set null;

-- Checkout writes through the authenticated client. Keep the existing
-- entitlement guard and also prevent a browser from forging invoice workflow
-- state or pretending that the mandatory consumer declarations were recorded.
drop policy "host records own pending purchase" on public.purchases;
create policy "host records own pending purchase"
  on public.purchases for insert to authenticated
  with check (
    status = 'pending'
    and owner_id = auth.uid()
    and invoice_status = 'not_started'
    and billing_type in ('individual', 'company')
    and billing_name is not null
    and billing_email is not null
    and billing_country_code = 'HU'
    and billing_post_code is not null
    and billing_city is not null
    and billing_address is not null
    and terms_version is not null
    and terms_accepted_at is not null
    and early_performance_consent_at is not null
    and billingo_partner_id is null
    and billingo_document_id is null
    and billingo_cancellation_document_id is null
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.owner_id = auth.uid()
    )
  );

create unique index purchases_billingo_document_idx
  on public.purchases (billingo_document_id)
  where billingo_document_id is not null;

create index purchases_invoice_retry_idx
  on public.purchases (invoice_status, invoice_next_attempt_at)
  where invoice_status in ('pending', 'send_failed', 'failed', 'blocked');

-- One worker may own an invoice attempt at a time. A five-minute lease makes a
-- crashed Vercel invocation recoverable when Stripe retries the webhook.
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
