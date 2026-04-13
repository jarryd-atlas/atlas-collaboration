import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

/**
 * The scopes the app currently requires. When a new scope is added,
 * users who authenticated before that change won't have it — we detect
 * this and prompt them to re-authenticate.
 */
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/**
 * GET /api/auth-check
 * Checks whether the current user's stored Google OAuth scopes
 * include all scopes the app now requires.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ needsReauth: false });
    }

    const { data: tokenData } = await (supabase as any)
      .from("user_google_tokens")
      .select("scopes")
      .eq("user_id", user.id)
      .single();

    if (!tokenData) {
      // No token stored — not necessarily a problem (e.g. magic-link users)
      return NextResponse.json({ needsReauth: false });
    }

    const storedScopes = (tokenData.scopes as string) ?? "";
    const missingScopes = REQUIRED_SCOPES.filter(
      (s) => !storedScopes.includes(s),
    );

    return NextResponse.json({
      needsReauth: missingScopes.length > 0,
      missingScopes,
    });
  } catch {
    return NextResponse.json({ needsReauth: false });
  }
}
