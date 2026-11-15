import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * CareSync AI — Request Entry Boundary (Next.js 16 Proxy Convention)
 *
 * Refreshes user session tokens before page rendering begins.
 * Authorization is strictly deferred to server components, server actions, and PostgreSQL RLS.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Support both proxy named export and default export
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Images / static assets ending with standard file extensions (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
