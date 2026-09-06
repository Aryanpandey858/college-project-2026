/**
 * client.ts — Browser-side Supabase client
 *
 * Initialized with the public anon key. Safe to expose to the browser.
 * Used for:
 *  - Supabase Realtime WebSocket subscriptions (IncidentDrawer live feed)
 *  - Reading public incident records
 *  - Subscribing to surveillance_stream broadcast channel (live viewer)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[Supabase Client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.local.example to .env.local and fill in your project credentials.'
  );
}

/**
 * Singleton browser Supabase client.
 * Lazily instantiated and reused across all components.
 */
let _browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          // Increase eventsPerSecond for smooth 5 FPS stream broadcast
          eventsPerSecond: 10,
        },
      },
    });
  }
  return _browserClient;
}

/** Default export for convenience in components */
export const supabase = getSupabaseClient();
