import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and
 * Route Handlers. Reads/writes the auth cookie via next/headers.
 *
 * Calling `.set()` from a Server Component (not a Route Handler/Server
 * Action) throws, because Server Components can't set response cookies —
 * that's expected and safe to ignore here since `proxy.ts` refreshes the
 * session on every request anyway.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render; proxy.ts handles refresh.
        }
      },
    },
  });
}
