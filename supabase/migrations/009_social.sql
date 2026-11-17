-- ============================================================================
-- 009: social layer. Accounts (Supabase Auth), profiles, follows (mutual
-- follow = friends), Going/Interested, saved events synced to the account,
-- and lists. Default privacy is friends-only: what someone is going to, their
-- passport and their friends-only lists are visible to mutual follows, or to
-- everyone if they make their profile public. Profiles themselves (name,
-- @username, avatar) are visible so people can find each other.
-- Run once in the Supabase SQL editor.
-- ============================================================================

-- ---------- profiles -------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 50),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 160),
  city text check (char_length(city) <= 40),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile is created for every new account, with a username made from the
-- Google name or email (made unique with digits when taken).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  tries int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'preferred_username', split_part(coalesce(new.email, ''), '@', 1), ''),
    '[^a-zA-Z0-9_]', '', 'g'));
  base := left(base, 15);
  if char_length(base) < 3 then base := base || 'user'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    tries := tries + 1;
    if tries > 25 then
      candidate := 'user' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
    candidate := base || (1000 + floor(random() * 9000))::int::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)), 50),
    left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), 500)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- follows --------------------------------------------------------
create table if not exists public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee_idx on public.follows (followee);

-- Friends = follow each other. Security definer so policies can call it
-- without recursing through follows' own policy.
create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = other
    or (
      exists (select 1 from public.follows where follower = auth.uid() and followee = other)
      and exists (select 1 from public.follows where follower = other and followee = auth.uid())
    )
  );
$$;

-- Can the current viewer see this person's activity?
create or replace function public.can_see(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_friend(owner)
    or exists (select 1 from public.profiles where id = owner and is_public);
$$;

-- ---------- going / interested ---------------------------------------------
create table if not exists public.attendance (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists attendance_event_idx on public.attendance (event_id, status);

drop trigger if exists attendance_updated on public.attendance;
create trigger attendance_updated before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------- saved events (synced from the device) --------------------------
create table if not exists public.saved_events (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------- lists ----------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text check (char_length(description) <= 280),
  visibility text not null default 'friends' check (visibility in ('private', 'friends', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_owner_idx on public.lists (owner);

drop trigger if exists lists_updated on public.lists;
create trigger lists_updated before update on public.lists
  for each row execute function public.set_updated_at();

create table if not exists public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  note text check (char_length(note) <= 140),
  added_at timestamptz not null default now(),
  primary key (list_id, event_id)
);

-- ---------- passport (stamps and badges, synced from the device) ----------
create table if not exists public.passports (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 32000),
  updated_at timestamptz not null default now()
);

-- ---------- row level security ---------------------------------------------
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.attendance enable row level security;
alter table public.saved_events enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.passports enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to anon, authenticated
  using (auth.uid() in (follower, followee) or public.can_see(follower) or public.can_see(followee));
drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own on public.follows for insert to authenticated with check (follower = auth.uid());
drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own on public.follows for delete to authenticated
  using (follower = auth.uid() or followee = auth.uid());

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to anon, authenticated using (public.can_see(user_id));
drop policy if exists attendance_write_own on public.attendance;
create policy attendance_write_own on public.attendance for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_own on public.saved_events;
create policy saved_own on public.saved_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists lists_read on public.lists;
create policy lists_read on public.lists for select to anon, authenticated
  using (owner = auth.uid() or visibility = 'public' or (visibility = 'friends' and public.is_friend(owner)));
drop policy if exists lists_write_own on public.lists;
create policy lists_write_own on public.lists for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists list_items_read on public.list_items;
create policy list_items_read on public.list_items for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id));
drop policy if exists list_items_write_own on public.list_items;
create policy list_items_write_own on public.list_items for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner = auth.uid()));

drop policy if exists passports_read on public.passports;
create policy passports_read on public.passports for select to anon, authenticated using (public.can_see(user_id));
drop policy if exists passports_write_own on public.passports;
create policy passports_write_own on public.passports for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.profiles, public.follows, public.attendance, public.lists, public.list_items, public.passports to anon, authenticated;
grant update (username, display_name, avatar_url, bio, city, is_public) on public.profiles to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, update, delete on public.attendance, public.saved_events, public.lists, public.list_items, public.passports to authenticated;
grant select on public.saved_events to authenticated;

-- ---------- read helpers ---------------------------------------------------

-- Events in the same shape the site's API returns (lat/lng, tickets).
create or replace function public.events_by_ids(ids uuid[])
returns table (
  id uuid, title text, description text, category text, start_time timestamptz, end_time timestamptz,
  location_name text, address text, city text, country text, lat double precision, lng double precision,
  image_url text, url text, price_min numeric, price_max numeric, is_free boolean, source text, tickets jsonb
)
language sql stable set search_path = public as $$
  select e.id, e.title, e.description, e.category::text, e.start_time, e.end_time,
         e.location_name, e.address, e.city, e.country,
         st_y(e.coords::geometry), st_x(e.coords::geometry),
         e.image_url, e.url, e.price_min, e.price_max, e.is_free, e.source, e.tickets
  from public.events e
  where e.id = any (ids[1:200]);
$$;

-- Follower / following / friend counts for a profile (numbers only).
create or replace function public.profile_stats(p uuid)
returns table (followers bigint, following bigint, friends bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.follows where followee = p),
    (select count(*) from public.follows where follower = p),
    (select count(*) from public.follows a join public.follows b
       on b.follower = a.followee and b.followee = a.follower
     where a.follower = p);
$$;

-- How many people are going / interested (numbers only, no names).
create or replace function public.event_counts(e uuid)
returns table (going bigint, interested bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where status = 'going'), count(*) filter (where status = 'interested')
  from public.attendance where event_id = e;
$$;

-- The viewer's friends who are going to / interested in an event.
create or replace function public.friends_at_event(e uuid)
returns table (user_id uuid, username text, display_name text, avatar_url text, status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, a.status
  from public.attendance a join public.profiles p on p.id = a.user_id
  where a.event_id = e and a.user_id <> auth.uid() and public.is_friend(a.user_id)
  order by a.status, a.updated_at desc
  limit 50;
$$;

-- Friends' plans: upcoming events the viewer's friends are going to.
create or replace function public.friends_upcoming(max_rows int default 40)
returns table (event_id uuid, user_id uuid, username text, display_name text, avatar_url text, status text, start_time timestamptz)
language sql stable security definer set search_path = public as $$
  select a.event_id, p.id, p.username, p.display_name, p.avatar_url, a.status, ev.start_time
  from public.attendance a
  join public.profiles p on p.id = a.user_id
  join public.events ev on ev.id = a.event_id
  where a.user_id <> auth.uid() and public.is_friend(a.user_id)
    and coalesce(ev.end_time, ev.start_time + interval '3 hours') > now()
  order by ev.start_time
  limit least(max_rows, 100);
$$;

grant execute on function public.events_by_ids(uuid[]), public.profile_stats(uuid), public.event_counts(uuid),
  public.friends_at_event(uuid), public.friends_upcoming(int), public.is_friend(uuid), public.can_see(uuid)
  to anon, authenticated;
