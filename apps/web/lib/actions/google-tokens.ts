"use server";

import { createSupabaseServer } from "../supabase/server";

/**
 * Store or update a user's Google OAuth tokens.
 * Called from the auth callback after Google sign-in.
 */
export async function storeGoogleToken(data: {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scopes: string;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Cast to any — user_google_tokens table not yet in generated types (migration pending)
  const { error } = await (supabase as any)
    .from("user_google_tokens")
    .upsert({
      user_id: user.id,
      access_token: data.accessToken,
      refresh_token: data.refreshToken ?? null,
      expires_at: data.expiresAt,
      scopes: data.scopes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Get a valid Google access token for the current user.
 * Refreshes the token if expired.
 */
export async function getGoogleAccessToken(): Promise<{ token: string } | { error: string }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: tokenData, error } = await (supabase as any)
    .from("user_google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !tokenData) {
    return { error: "No Google token stored. Please sign in with Google again." };
  }

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(tokenData.expires_at).getTime();
  const now = Date.now();

  if (now < expiresAt - 5 * 60 * 1000) {
    // Token is still valid
    return { token: tokenData.access_token };
  }

  // Token expired — try to refresh
  if (!tokenData.refresh_token) {
    return { error: "Google token expired and no refresh token available. Please sign in with Google again." };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      return { error: "Failed to refresh Google token. Please sign in with Google again." };
    }

    const refreshed = await response.json();

    // Update stored token
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await (supabase as any)
      .from("user_google_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return { token: refreshed.access_token };
  } catch {
    return { error: "Failed to refresh Google token." };
  }
}
