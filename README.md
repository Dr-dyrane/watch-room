# Watch Room

Minimal full-stack watch room with Supabase, a 4-digit passcode, theme toggle, and installable PWA metadata.

## Run

```bash
npm install
npm run dev
```

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `WATCH_ROOM_SECRET=0326`
- `NEXT_SUPABASE_SERVICE_ROLE` or `SUPABASE_SERVICE_ROLE_KEY`

## Database

Remote migration already applied from [`supabase/migrations/20260416010000_watch_room.sql`](./supabase/migrations/20260416010000_watch_room.sql).
