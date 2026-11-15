import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientEnv } from "@/lib/env";

/**
 * CareSync AI — Supabase Server Client
 *
 * Designed for Server Components, Server Actions, and Route Handlers.
 * In Next.js 15+, cookies() is an asynchronous function returning a Promise<ReadonlyRequestCookies>.
 *
 * Implements getAll and setAll cookie handlers.
 * Wraps setAll in a try/catch block so that calls in Server Components (where cookie mutation
 * is restricted by Next.js) fail gracefully without crashing.
 *
 * Uses only client-safe credentials (URL and ANON key). Does NOT use SUPABASE_SERVICE_ROLE_KEY
 * for ordinary user requests, strictly enforcing PostgreSQL Row-Level Security (RLS).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getClientEnv();

  return createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
