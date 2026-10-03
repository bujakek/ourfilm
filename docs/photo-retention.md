# Photo retention: proposed policy and release requirements

Status: **draft legal change, not an implemented retention job**.

The legal pages previously promised retention until host deletion, with no
automatic expiry. This proposal replaces that rule for new events created under
the revised terms. Do not deploy the retention copy or its `LEGAL_VERSION` bump
until the enforcement and transition requirements below are met.

## Proposed policy

- Free and paid events: photos remain available for 12 calendar months from
  the configured end of the shooting window (`capture_end_at`), subject to
  existing reveal, access and moderation rules.
- After-event uploads are optional, admitted within the 24-hour window, and
  consume the guest's original roll. They do not restart retention or change
  capture/reveal times. Existing accepted reservations can still finish on the
  existing retry path; the legal text does not promise all network transfers
  finish within the admission window.
- At expiry, gallery access ends and photos, their display variants, event
  content and associated guest/session records are deleted from active service.
  Hosts can delete earlier and data-subject erasure requests remain available.
- Account, transaction, invoice and claims records follow their separate
  retention rules. An obligation to retain an invoice does not justify retaining
  the whole photo gallery.
- The public photo address has no token expiry. Hiding is moderation and leaves
  the object accessible by its exact address. Deletion must remove the bytes,
  with cache and backup handling treated separately.
- The draft does not promise deletion-warning emails, paid extensions,
  indefinite archives or preservation of original camera files. Uploaded masters
  are processed JPEGs, with separate view and thumbnail variants.

## Required before release

1. **Record applicability per event.** Paid checkouts already carry
   `LEGAL_VERSION` and the purchase stores `terms_version` and acceptance time.
   Event creation checks `legalAccepted` but does not currently persist the
   accepted version for free events. Persist an event-level policy version,
   acceptance time and concrete retention deadline before enforcing this rule.
   Do not infer applicability from today's version constant alone.
2. **Protect earlier events.** Earlier terms allowed retention until host
   deletion. The revised privacy notice preserves those earlier terms; the
   existing Terms changes section also preserves accepted paid-order terms.
   Do not backfill a destructive 12-month deadline for those events merely
   because this copy has changed. Any transition needs an explicit contractual
   basis, clear host notice and enough time to export. An upgrade or an in-flight
   checkout must not silently reclassify an older event. Archive the old legal
   copy and keep historical checkout versions intact.
3. **Define calendar arithmetic and edits.** Materialise the deadline from
   `capture_end_at` plus 12 calendar months in the event's stored time zone;
   handle month ends, leap days and daylight-saving transitions explicitly.
   Decide and implement how changing the event end changes that deadline, and
   show the resulting date to the host. Neither upload time nor the end of the
   after-event window is the retention anchor.
4. **Enforce expiry and delete bytes reliably.** There is no event-retention
   sweep in the current repository. Implement access/admission checks and
   retryable cleanup covering every photo render, covers, pending/orphan objects,
   prepared ZIP archives, export jobs and in-flight uploads/exports. Removing
   database rows or hiding photos alone leaves public objects accessible. The
   current host `deleteEvent` action removes the photo folder before deleting
   rows, but is not a complete scheduled-retention implementation; audit export
   storage and deletion races rather than copying it unchanged. Preserve
   independently required accounting records.
5. **Verify caches and backup periods.** Determine the actual bounded cache
   and backup lifetimes for each provider, and document them before publishing.
   Use cache invalidation where available; do not promise simultaneous physical
   erasure from every copy. A backup restore must reapply deletion records
   before content becomes accessible. Do not use backup-cycle wording to allow
   indefinite retention of ordinary active copies.
6. **Communicate the deadline.** Display the applicable deadline and download
   action in the host flow, and keep the guest-facing notice linked before
   joining/uploading. Decide separately whether to add 30-day and 7-day warning
   emails; neither those emails nor their delivery are implemented or promised
   by this PR. Keep support answers consistent with what is deployed.
7. **Coordinate publication.** Ship both locales, the matching legal version,
   acceptance recording and enforcement together. The dates in this proposal
   describe the draft revision, not a retroactive production cutover. Update
   display dates if revised at release. Run `pnpm verify` and the applicable
   local database tests for the enforcement change.

## Scope of the legal edit

- `/hu/aszf` and `/en/terms`: service description, after-event upload rules and
  a dedicated availability/retention section.
- `/hu/adatvedelem` and `/en/privacy`: selected gallery files, the retention
  purpose and duration, earlier-event treatment, deletion and direct-URL/cache
  behavior. Existing controller/processor roles and erasure-request routes are
  preserved; this proposal does not resolve every wider privacy-contract issue.
- `lib/company.ts`: legal version plus independent Terms/Privacy update dates.

The aliases reuse the same page implementations; no duplicate legal pages or
new rendering logic are needed.

## Primary references

- [European Commission: GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en):
  storage limitation and deletion/review periods tied to the processing purpose.
- [European Commission: obligations](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en):
  information to individuals, including how long their data is stored.
- [GDPR, Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj):
  Articles 5(1)(e), 13(2)(a), 17 and, where processing on a host's behalf applies,
  28(3)(g).
