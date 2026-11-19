-- ============================================================================
-- 011: Reminders for saved events, sent as push notifications.
--
-- A device that turns reminders on hands over its push subscription and the
-- events it has saved; the site sends one notification per event a couple of
-- hours before it starts. No account is needed: the device's push address is
-- the key. Only the server (service-role key) touches these tables.
-- Run once in the Supabase SQL editor, after 010.
-- ============================================================================

create table if not exists public.push_devices (
  endpoint text primary key check (char_length(endpoint) between 20 and 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create table if not exists public.push_reminders (
  endpoint text not null references public.push_devices (endpoint) on delete cascade on update cascade,
  event_id text not null check (char_length(event_id) between 1 and 100),
  remind_at timestamptz not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 200),
  url text not null check (char_length(url) between 1 and 300),
  sent_at timestamptz,
  primary key (endpoint, event_id)
);

create index if not exists push_reminders_due_idx
  on public.push_reminders (remind_at) where sent_at is null;

alter table public.push_devices enable row level security;
alter table public.push_reminders enable row level security;
-- No policies: the public API can't read or write these at all.
revoke all on public.push_devices, public.push_reminders from anon, authenticated;
