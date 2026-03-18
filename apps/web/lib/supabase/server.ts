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
 * Get the current user's session and profile from the database.
 * Falls back to DB lookup when JWT custom claims aren't available
 * (e.g. when the JWT hook is disabled).
 */
export async function getSession() {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  // Try to get claims from JWT first
  const jwtPayload = session.access_token
    ? JSON.parse(atob(session.access_token.split(".")[1]!))
    : {};

  let claims = {
    tenantId: jwtPayload.tenant_id as string | undefined,
    tenantType: jwtPayload.tenant_type as "internal" | "customer" | undefined,
    appRole: jwtPayload.app_role as
      | "super_admin"
      | "admin"
      | "member"
      | undefined,
    profileId: jwtPayload.profile_id as string | undefined,
    profileStatus: jwtPayload.profile_status as string | undefined,
  };

  // If JWT claims are missing (hook disabled), look up profile from DB
  if (!claims.profileId) {
    const admin = createSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, status, tenant_id, tenants(type)")
      .eq("user_id", session.user.id)
      .single();

    if (profile) {
      const tenantType = (profile.tenants as unknown as { type: string })?.type;
      claims = {
        tenantId: profile.tenant_id,
        tenantType: tenantType as "internal" | "customer",
        appRole: profile.role as "super_admin" | "admin" | "member",
        profileId: profile.id,
        profileStatus: profile.status,
      };
    }
  }

  return {
    session,
    user: session.user,
    claims,
  };
}

/**
 * Require an authenticated session or throw.
 * Use in server actions that need auth.
 */
export async function requireSession() {
  const result = await getSession();
  if (!result) {
    throw new Error("Unauthorized");
  }
  // If no profile exists yet (first-time user), allow through
  // with limited claims — the action itself should handle this
  if (result.claims.profileStatus && result.claims.profileStatus !== "active") {
    throw new Error("Account not active");
  }
  return result;
}
