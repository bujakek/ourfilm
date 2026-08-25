-- Drop `events_reveal_at_check`.
--
-- It said: a custom reveal may not precede the capture end. That is a sound
-- rule for *scheduling* a later reveal, and the wrong rule for the column,
-- because it also forbade the one action the host most wants at a party —
-- "Galéria megnyitása most", which writes `reveal_mode = 'custom'` and
-- `reveal_at = now()` while the camera is still running.
--
-- Found by a test: early reveal silently did nothing, because the constraint
-- violation surfaced as an update matching zero rows.
--
-- The rule itself is not gone, it moved to where it belongs. It is a validation
-- on what a host may *type into a form*, enforced in `setReveal` and in the
-- create wizard (`validateEventDraft`), both of which can say something useful
-- when they refuse. It was never a security property: an event's reveal time is
-- the host's own decision about their own album, and there is no value of it
-- that lets anyone see something they should not — `event_gallery_by_slug`
-- still checks `guests_can_view` separately.
--
-- Keeping it as a constraint would have meant every deliberate override needing
-- a way around it, which is how a constraint stops describing the data and
-- starts being an obstacle.

alter table public.events
  drop constraint if exists events_reveal_at_check;

-- `events_capture_window_check` stays. That one really is an invariant: an
-- event whose camera closes before it opens is nonsense in every mode, and
-- nothing in the product ever wants to write one.
