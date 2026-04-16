function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getServerEnv() {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? requireEnv('NEXT_SUPABASE_SERVICE_ROLE'),
    roomSlug: process.env.NEXT_PUBLIC_ROOM_SLUG ?? 'watch-room',
    roomTitle: process.env.NEXT_PUBLIC_ROOM_TITLE ?? 'Watch Room',
    roomSecret: requireEnv('WATCH_ROOM_SECRET'),
  };
}
