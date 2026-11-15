import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/lib/env";

/**
 * CareSync AI — Session Refresh Utility for Next.js Proxy / Middleware
 *
 * Responsibilities:
 * 1. Refreshes the Supabase Auth session token (if expired) before Server Components execute.
 * 2. Propagates updated Set-Cookie headers from Supabase back to the browser.
 * 3. Never treats session refresh as route authorization: protected operations and RLS
 *    must perform server-side checks independently.
 * 4. Skips when required environment variables are not configured (e.g. during initial build).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Safely retrieve client environment; if unconfigured during static build, pass through
  let clientEnv;
  try {
    clientEnv = getClientEnv();
  } catch {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  // Calling getUser() validates the JWT with the Supabase Auth server, refreshing tokens if needed.
  // Note: We use getUser() rather than getSession() for cryptographic and security verification.
  await supabase.auth.getUser();

  return supabaseResponse;
}
