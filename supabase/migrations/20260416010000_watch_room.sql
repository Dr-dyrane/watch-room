create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  session_id text not null,
  name text not null,
  role text not null check (role in ('host', 'guest')),
  is_ready boolean not null default false,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (room_id, session_id)
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  session_id text not null,
  sender text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_playback_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  session_id text not null,
  sender text not null,
  action text not null check (action in ('PLAY', 'PAUSE', 'SEEK_FORWARD', 'SEEK_BACKWARD', 'SYNC_NOW')),
  playback_time integer not null default 0,
  title text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_playback_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  event_id bigint not null references public.room_playback_events(id) on delete cascade,
  session_id text not null,
  sender text not null,
  action text not null,
  playback_time integer not null default 0,
  is_playing boolean not null default false,
  title text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_members_room_id_idx on public.room_members (room_id);
create index if not exists room_messages_room_id_created_at_idx on public.room_messages (room_id, created_at desc);
create index if not exists room_playback_events_room_id_created_at_idx on public.room_playback_events (room_id, created_at desc);
