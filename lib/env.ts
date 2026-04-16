export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    '',
  roomSlug: process.env.NEXT_PUBLIC_ROOM_SLUG?.trim() || 'watch-room',
  roomTitle: process.env.NEXT_PUBLIC_ROOM_TITLE?.trim() || 'Watch Room',
};

export function getPublicRoomConfig() {
  return publicEnv;
}
