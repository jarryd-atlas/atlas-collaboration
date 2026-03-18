import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json([]);

    // Get profile id from user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single() as { data: any; error: unknown };

    if (!profile?.id) return NextResponse.json([]);

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
