function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return normalized;
}

export function getServerEnv() {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? requireEnv('NEXT_SUPABASE_SERVICE_ROLE'),
    roomSlug: process.env.NEXT_PUBLIC_ROOM_SLUG?.trim() || 'watch-room',
    roomTitle: process.env.NEXT_PUBLIC_ROOM_TITLE?.trim() || 'Watch Room',
    roomSecret: requireEnv('WATCH_ROOM_SECRET'),
  };
}
