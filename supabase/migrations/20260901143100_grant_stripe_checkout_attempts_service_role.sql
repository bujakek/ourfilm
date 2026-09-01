-- Data API table privileges are not inherited reliably by tables created after
-- the explicit grants migration. The checkout-attempt ledger remains hidden
-- from browser roles; trusted server code needs direct access for operations
-- and deterministic database test setup.
grant select, insert, update, delete
  on table public.stripe_checkout_attempts
  to service_role;
