import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("redirect") ?? "/";

  // Use the configured site URL for redirects (works on any host)
  const siteUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "https://atlas-collaboration.jarryd-71d.workers.dev"
    : "http://localhost:3000";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if this is a first-time user (redirect to welcome)
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        try {
          const claims = JSON.parse(atob(session.access_token.split(".")[1]!));
          const profileStatus = claims.profile_status;

          if (profileStatus === "pending" || profileStatus === "pending_approval") {
            return NextResponse.redirect(`${siteUrl}/pending`);
          }
        } catch {
          // Continue to default redirect
        }
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`);
}
