import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Service-role Supabase client. Bypasses RLS — never import this into
 * client-side code, and never use it to act on behalf of a specific request
 * without an explicit, already-verified user id.
 */
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
