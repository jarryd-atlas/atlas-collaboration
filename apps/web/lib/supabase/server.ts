/**
 * Supabase server utilities for Next.js App Router.
 * Creates typed Supabase clients for server components and server actions.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";

/**
 * Create a Supabase client for server components / route handlers.
 * Uses the user's session cookies for RLS-scoped queries.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Can happen in server components where cookies can't be set
          }
        },
      },
    },
  );
}

/**
 * Create a Supabase admin client (service role).
 * Bypasses RLS — use only in server actions for admin operations.
 */
export function createSupabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Get the current user's session and profile claims from JWT.
 * Returns null if not authenticated.
 */
export async function getSession() {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // Extract custom claims from JWT
  const claims = session.access_token
    ? JSON.parse(atob(session.access_token.split(".")[1]!))
    : {};

  return {
    session,
    user: session.user,
    claims: {
      tenantId: claims.tenant_id as string | undefined,
      tenantType: claims.tenant_type as "internal" | "customer" | undefined,
      appRole: claims.app_role as
        | "super_admin"
        | "admin"
        | "member"
        | undefined,
      profileId: claims.profile_id as string | undefined,
      profileStatus: claims.profile_status as string | undefined,
    },
  };
}

/**
 * Require an authenticated session or throw.
 * Use in server actions that need auth.
 */
export async function requireSession() {
  const result = await getSession();
  if (!result || !result.claims.profileId) {
    throw new Error("Unauthorized");
  }
  if (result.claims.profileStatus !== "active") {
    throw new Error("Account not active");
  }
  return result;
}
