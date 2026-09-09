-- Billingo invoicing for the Hungarian, directly-settled Stripe purchases.
--
-- `purchases` remains the payment ledger. The columns below add the immutable
-- billing snapshot and the state needed to make the external Billingo calls
-- recoverable. A Billingo document is keyed by `purchases.id` through
-- `vendor_id`, so a timeout after document creation can be reconciled instead
-- of producing a second invoice.
--
-- Only `settlement = 'direct'` rows are ours to invoice. On the Managed
-- Payments path Link, LLC is the merchant of record and issues the
-- customer-facing document itself; issuing a Billingo invoice for one of those
-- would be documenting the same transaction twice, under the wrong seller.

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
  -- Which arrangement sold this. Stored rather than derived from the currency:
  -- the currency is a consequence of the event's locale, and reading a legal
  -- relationship out of it would be a guess that silently changes the day a
  -- second HUF price or a third locale exists.
  add column settlement text not null default 'managed',
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
  add constraint purchases_settlement_check
    check (settlement in ('managed', 'direct')),
  add constraint purchases_billing_type_check
    check (billing_type is null or billing_type in ('individual', 'company')),
  add constraint purchases_billing_country_check
    check (billing_country_code is null or billing_country_code = 'HU'),
  add constraint purchases_billing_tax_number_check
    check (
      billing_type is null
      or billing_type = 'individual'
      or billing_tax_number ~ '^[0-9]{8}-[0-9]-[0-9]{2}$'
    ),
  -- A Managed Payments row must never acquire invoicing state. Link issues
  -- that document, so anything past 'not_started' here is a bug that would
  -- put a second invoice in front of a customer who already has one.
  add constraint purchases_managed_not_invoiced_check
    check (settlement = 'direct' or invoice_status = 'not_started');

-- Accounting records must survive deletion of the album or host account. The
-- billing snapshot above is self-contained, while nullable references avoid
-- retaining the deleted product/account solely to satisfy a foreign key.
--
-- This also retires the reason the webhook treated a deleted event as an
-- unrecoverable orphan: the purchase row now outlives the event.
alter table public.purchases
  drop constraint purchases_event_id_fkey,
  drop constraint purchases_owner_id_fkey,
  alter column event_id drop not null,
  alter column owner_id drop not null,
  add constraint purchases_event_id_fkey
    foreign key (event_id) references public.events (id) on delete set null,
  add constraint purchases_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete set null;

-- Checkout writes only the pending ledger row through the authenticated
-- client, and now writes the id and the amount it is about to ask Stripe for.
-- Stripe supplies the immutable invoice snapshot and the declarations after
-- payment; only the service-role webhook may write those fields. The amount is
-- host-supplied and therefore not trusted — the webhook compares it against
-- what Stripe reports before a single forint is invoiced.
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
    and exists (
      select 1 from public.events e
      where e.id = event_id and e.owner_id = auth.uid()
    )
  );

create unique index purchases_billingo_document_idx
  on public.purchases (billingo_document_id)
  where billingo_document_id is not null;

-- What the retry sweep reads. Partial, because the settled majority of the
-- table is exactly what it must never scan.
create index purchases_invoice_retry_idx
  on public.purchases (invoice_next_attempt_at)
  where invoice_status in (
    'pending', 'send_failed', 'failed', 'blocked', 'cancellation_pending'
  );

-- One worker may own an invoice attempt at a time. A five-minute lease makes a
-- crashed Vercel invocation recoverable when the sweep comes back round.
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

-- The same lease for the storno path.
--
-- A cancellation has no `vendor_id` probe to fall back on — Billingo will
-- happily issue a second storno document for the same invoice — so the lease
-- is the only thing standing between two concurrent refund deliveries and two
-- cancellation documents. Here `invoicing_started_at` alone carries the lease,
-- because 'cancellation_pending' is already the working state.
create or replace function public.claim_purchase_invoice_cancellation(
  p_purchase_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  update public.purchases
  set invoice_attempts = invoice_attempts + 1,
      invoice_last_error = null,
      invoice_next_attempt_at = null,
      invoicing_started_at = now()
  where id = p_purchase_id
    and settlement = 'direct'
    and invoice_status = 'cancellation_pending'
    and (
      invoicing_started_at is null
      or invoicing_started_at < now() - interval '5 minutes'
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

-- Supabase grants execute to anon and authenticated directly, so revoking from
-- public is not enough. A host must not be able to drive their own invoicing.
revoke all on function public.claim_purchase_invoice(uuid) from public;
revoke all on function public.claim_purchase_invoice(uuid) from anon, authenticated;
grant execute on function public.claim_purchase_invoice(uuid) to service_role;
revoke all on function public.claim_purchase_invoice_cancellation(uuid) from public;
revoke all on function public.claim_purchase_invoice_cancellation(uuid) from anon, authenticated;
grant execute on function public.claim_purchase_invoice_cancellation(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- The invoice retry clock.
--
-- The Stripe webhook makes the first attempt, but it must not be the only one.
-- A 402 from Billingo — the document quota on the API add-on — is a certainty
-- rather than a possibility, and a host who paid and never received an invoice
-- is a legal problem, not a degraded feature. So the same pg_cron/Vault shape
-- the album exports use, for the same reasons recorded there.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoice_cron_jobs()
returns table (jobname text, schedule text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text, j.schedule::text, j.active
  from cron.job j
  where j.jobname like 'invoices-%'
  order by j.jobname
$$;

revoke all on function public.invoice_cron_jobs() from public;
revoke all on function public.invoice_cron_jobs() from anon, authenticated;
grant execute on function public.invoice_cron_jobs() to service_role;

select cron.schedule(
  'invoices-sweep-http',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := s.api_url || '/api/invoices/sweep',
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || s.secret,
      'content-type',  'application/json'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'ourfilm_api_url' limit 1)      as api_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'export_worker_secret' limit 1) as secret
  ) s
  where s.api_url is not null and s.secret is not null
  $$
);
