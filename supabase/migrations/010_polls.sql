-- ============================================================================
-- 010: "Who's free?" polls. A signed-in person picks 2-3 events and shares a
-- link; friends vote (no account needed, just a name); the creator locks in
-- the winner and everyone can mark themselves going.
--
-- All access goes through the functions below (security definer), so the
-- tables themselves are closed to the public API: voters never see each
-- other's private voter keys, and nobody can edit a poll that isn't theirs.
-- Run once in the Supabase SQL editor, after 009.
-- ============================================================================

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  event_ids uuid[] not null check (cardinality(event_ids) between 2 and 3),
  winner uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  -- 'u:<user id>' for signed-in voters, otherwise a random key the voter's
  -- browser keeps. Knowing the key is what lets you change your vote.
  voter_key text not null check (char_length(voter_key) between 20 and 80),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  event_id uuid not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, voter_key)
);

create index if not exists polls_creator_idx on public.polls (creator, created_at desc);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
-- No policies: with RLS on and none granted, the API can't touch the tables
-- directly. The functions below are the only way in.
revoke all on public.polls, public.poll_votes from anon, authenticated;

-- Start a poll. Returns its id (the share link is /poll/<id>).
create or replace function public.create_poll(p_title text, p_event_ids uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to start a poll' using errcode = '28000';
  end if;
  select array_agg(distinct x) into ids from unnest(p_event_ids) as x;
  if coalesce(cardinality(ids), 0) not between 2 and 3 then
    raise exception 'Pick 2 or 3 different events' using errcode = '22023';
  end if;
  if (select count(*) from public.events e where e.id = any (ids)) <> cardinality(ids) then
    raise exception 'One of those events no longer exists' using errcode = '22023';
  end if;
  if (select count(*) from public.polls where creator = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of polls today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.polls (creator, title, event_ids)
  values (auth.uid(), left(coalesce(nullif(btrim(p_title), ''), 'Which one?'), 80), ids)
  returning id into new_id;
  return new_id;
end $$;

-- Everything the poll page needs, in one call. Voter keys never leave the
-- database; `mine` says which event (if any) the caller voted for.
create or replace function public.get_poll(p_id uuid, p_key text default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'event_ids', to_jsonb(p.event_ids),
    'winner', p.winner,
    'created_at', p.created_at,
    'is_mine', coalesce(p.creator = auth.uid(), false),
    'creator', (
      select jsonb_build_object('username', pr.username, 'display_name', pr.display_name, 'avatar_url', pr.avatar_url)
      from public.profiles pr where pr.id = p.creator
    ),
    'mine', (
      select v.event_id from public.poll_votes v
      where v.poll_id = p.id
        and v.voter_key = case when auth.uid() is not null then 'u:' || auth.uid()::text else 'g:' || p_key end
    ),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(pr.display_name, v.name),
        'avatar_url', pr.avatar_url,
        'username', pr.username,
        'event_id', v.event_id
      ) order by v.voted_at)
      from public.poll_votes v
      left join public.profiles pr on pr.id = v.user_id
      where v.poll_id = p.id
    ), '[]'::jsonb)
  )
  from public.polls p
  where p.id = p_id;
$$;

-- Vote, or change your vote. Signed-in voters are keyed by their account;
-- guests by the random key their browser keeps.
create or replace function public.cast_vote(p_id uuid, p_event uuid, p_name text default null, p_key text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  poll public.polls;
  key text;
  who text;
begin
  select * into poll from public.polls where id = p_id;
  if not found then
    raise exception 'Poll not found' using errcode = 'P0002';
  end if;
  if poll.winner is not null then
    raise exception 'This poll is closed' using errcode = '22023';
  end if;
  if not (p_event = any (poll.event_ids)) then
    raise exception 'That event isn''t in this poll' using errcode = '22023';
  end if;

  if auth.uid() is not null then
    key := 'u:' || auth.uid()::text;
    select coalesce(display_name, username) into who from public.profiles where id = auth.uid();
    who := coalesce(who, nullif(btrim(p_name), ''), 'Someone');
  else
    if p_key is null or char_length(p_key) not between 20 and 80 then
      raise exception 'Missing voter key' using errcode = '22023';
    end if;
    who := nullif(btrim(p_name), '');
    if who is null then
      raise exception 'Add your name to vote' using errcode = '22023';
    end if;
    key := 'g:' || p_key;
  end if;

  if (select count(*) from public.poll_votes where poll_id = p_id) >= 200
     and not exists (select 1 from public.poll_votes where poll_id = p_id and voter_key = key) then
    raise exception 'This poll is full' using errcode = '54000';
  end if;

  insert into public.poll_votes (poll_id, voter_key, user_id, name, event_id)
  values (p_id, key, auth.uid(), left(who, 40), p_event)
  on conflict (poll_id, voter_key) do update
    set event_id = excluded.event_id, name = excluded.name, voted_at = now();
end $$;

-- The creator locks in the winner (or reopens with null).
create or replace function public.lock_poll(p_id uuid, p_event uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.polls set winner = p_event
  where id = p_id and creator = auth.uid() and (p_event is null or p_event = any (event_ids));
  if not found then
    raise exception 'Only the person who started the poll can do that' using errcode = '42501';
  end if;
end $$;

revoke execute on function public.create_poll(text, uuid[]), public.get_poll(uuid, text),
  public.cast_vote(uuid, uuid, text, text), public.lock_poll(uuid, uuid) from public;
grant execute on function public.get_poll(uuid, text), public.cast_vote(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.create_poll(text, uuid[]), public.lock_poll(uuid, uuid) to authenticated;
