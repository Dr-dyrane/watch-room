-- Authoritative Room State Migration

-- 1. Rename room_members to room_participants
alter table if exists public.room_members rename to room_participants;

-- 2. Rename room_messages to room_chat
alter table if exists public.room_messages rename to room_chat;

-- 3. Add playback state fields to rooms
alter table public.rooms add column if not exists is_playing boolean not null default false;
alter table public.rooms add column if not exists playback_time float8 not null default 0;
alter table public.rooms add column if not exists playback_updated_at timestamptz not null default timezone('utc', now());
alter table public.rooms add column if not exists playback_updated_by text; -- session_id/device_id
alter table public.rooms add column if not exists last_action text; -- 'PLAY', 'PAUSE', 'SEEK', etc.

-- 4. Enable Realtime for the new authoritative tables
-- Rename handles the existing subscriptions for participants and chat
alter publication supabase_realtime add table public.rooms;

-- 5. Indexes for performance
create index if not exists room_participants_room_id_idx on public.room_participants (room_id);
create index if not exists room_chat_room_id_created_at_idx on public.room_chat (room_id, created_at desc);

-- 6. Optional: Drop redundant tables to keep schema clean (as we use rooms table as boss)
-- drop table if exists public.room_playback_state;
-- drop table if exists public.room_playback_events;
