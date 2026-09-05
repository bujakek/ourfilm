-- Return a stable photo identity with each frame. The client may have several
-- local captures while only a later one has committed; reconciling by array
-- length hides the wrong developing cell and draws the committed one twice.
drop function public.my_frames(uuid, text);

create function public.my_frames(
  p_event_id   uuid,
  p_token_hash text
)
returns table (
  photo_id    uuid,
  frame_index int,
  thumb_path  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    row_number() over (order by p.created_at, p.id)::int,
    case when p.hidden_at is null then p.thumb_path end
  from public.photos p
  where p.status = 'ready'
    and p.participant_id = (
      select pa.id
      from public.participants pa
      where pa.event_id = p_event_id
        and pa.session_token_hash = p_token_hash
    )
  order by p.created_at, p.id
$$;

revoke all on function public.my_frames(uuid, text) from public;
revoke all on function public.my_frames(uuid, text)
  from anon, authenticated;
grant execute on function public.my_frames(uuid, text) to service_role;
