import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    return null;
  }

  browserClient = createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return browserClient;
}
