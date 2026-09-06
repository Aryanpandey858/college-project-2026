/**
 * server.ts — Server-side Supabase client (Service Role)
 *
 * Initialized with the privileged service_role key.
 * ⚠️  NEVER import this in any client-side ("use client") component.
 *
 * Used exclusively in Next.js API Route Handlers (server context) for:
 *  - Uploading evidence snapshots to Supabase Storage (`incident-snapshots` bucket)
 *  - Inserting incident rows into PostgreSQL with RLS bypass
 *  - Reading any row regardless of RLS policies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    '[Supabase Server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Ensure these are set in .env.local (server-only, never expose to browser).'
  );
}

/**
 * Singleton server-side Supabase client with service role privileges.
 * Instantiated once per serverless cold start and reused across requests.
 */
let _serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!_serverClient) {
    _serverClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        // Disable auto-refresh for token — not needed in serverless context
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _serverClient;
}

/** Default export for convenience in API routes */
export const supabaseServer = getSupabaseServerClient();
