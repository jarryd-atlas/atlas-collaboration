/**
 * Get the current user's profile from Supabase auth session.
 * Returns null if not authenticated.
 */

import { getSession } from "../supabase/server";
import { getProfileById } from "./queries";

export async function getCurrentUser() {
  try {
    const session = await getSession();
    if (!session?.claims?.profileId) return null;

    const profile = await getProfileById(session.claims.profileId);
    return profile
      ? {
          ...profile,
          email: session.user.email ?? "",
          avatarUrl: session.user.user_metadata?.avatar_url ?? profile.avatar_url ?? null,
          sessionClaims: session.claims,
        }
      : null;
  } catch {
    return null;
  }
}
