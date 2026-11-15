import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

/**
 * CareSync AI — Supabase Browser Client
 *
 * Designed for Client Components ("use client").
 * Uses public variables (URL and ANON key) and manages session tokens in browser cookies.
 * Does NOT access or expose SUPABASE_SERVICE_ROLE_KEY.
 */
export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } =
    getClientEnv();

  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
