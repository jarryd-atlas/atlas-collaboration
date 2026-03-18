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
  const email = formData.get("email") as string;

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (error) throw error;

  return { success: true, email };
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function markNotificationRead(notificationId: string) {
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) throw error;
}
