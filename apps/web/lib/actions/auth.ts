"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer, createSupabaseAdmin } from "../supabase/server";

export async function signInWithGoogle(): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          hd: "crossnokaye.com",
        },
      },
    });

    if (error) return { url: null, error: error.message };
    return { url: data.url, error: null };
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function signInWithMagicLink(formData: FormData) {
  try {
    const email = formData.get("email") as string;

    const supabase = await createSupabaseServer();
    const { error: dbError } = await supabase.auth.signInWithOtp({
      email,
    });

    if (dbError) return { error: dbError.message };

    return { success: true, email };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markNotificationRead(notificationId: string) {
  try {
    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    if (dbError) return { error: dbError.message };

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
