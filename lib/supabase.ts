import { createClient } from '@supabase/supabase-js';

import { getServerEnv } from '@/lib/server-env';

export function createSupabaseAdminClient() {
  const serverEnv = getServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
