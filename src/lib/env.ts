import { z } from "zod";

/**
 * CareSync AI — Environment Variable Security Schema
 *
 * Validates and exposes:
 * 1. Client-safe public environment variables (prefixed with NEXT_PUBLIC_).
 * 2. Server-only secrets (fails hard if accessed in client / browser bundles).
 */

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({
      error: "NEXT_PUBLIC_SUPABASE_URL is required.",
    })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({
      error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required.",
    })
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty."),
});

const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({
      error: "SUPABASE_SERVICE_ROLE_KEY is required on the server.",
    })
    .min(1, "SUPABASE_SERVICE_ROLE_KEY cannot be empty."),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatErrors(errors: z.ZodError): string {
  return errors.issues
    .map((issue) => `  - [${issue.path.join(".") || "root"}]: ${issue.message}`)
    .join("\n");
}

/**
 * Returns validated client-safe environment variables.
 * Safe to call from Client Components, Server Components, Route Handlers, and Middleware.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const message = `[CareSync AI Environment Security] Invalid or missing client environment variables:\n${formatErrors(
      parsed.error
    )}`;
    console.error(message);
    throw new Error(message);
  }

  return parsed.data;
}

/**
 * Returns validated server-only environment variables including secrets.
 * Guarded against execution in browser runtimes.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "[CareSync AI Security Violation] Attempted to access getServerEnv() in a browser/client environment. Secrets must never be leaked to the client bundle."
    );
  }

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const message = `[CareSync AI Environment Security] Invalid or missing server environment variables:\n${formatErrors(
      parsed.error
    )}`;
    console.error(message);
    throw new Error(message);
  }

  return parsed.data;
}
