export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    '',
  roomSlug: process.env.NEXT_PUBLIC_ROOM_SLUG ?? 'watch-room',
  roomTitle: process.env.NEXT_PUBLIC_ROOM_TITLE ?? 'Watch Room',
};

export function getPublicRoomConfig() {
  return publicEnv;
}
