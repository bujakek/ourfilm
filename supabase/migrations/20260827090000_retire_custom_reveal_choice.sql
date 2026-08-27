-- The MVP now offers two reveal rules: immediately, or at the event end.
-- Preserve the enum value for backwards compatibility, but move existing
-- custom events onto the equivalent supported rule. An album that has already
-- opened stays open; a future custom reveal moves to the capture end.
update public.events
set reveal_mode = case
      when reveal_at <= now() then 'instant'::public.reveal_mode
      else 'event_end'::public.reveal_mode
    end,
    reveal_at = case
      when reveal_at <= now() then capture_start_at
      else capture_end_at
    end
where reveal_mode = 'custom';
