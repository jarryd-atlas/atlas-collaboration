"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServer, createSupabaseAdmin } from "../supabase/server";

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithGoogle() {
  const baseUrl = await getBaseUrl();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/callback`,
      queryParams: {
        hd: "crossnokaye.com",
      },
    },
  });

  if (error) throw error;
  if (data.url) redirect(data.url);
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get("email") as string;
  const baseUrl = await getBaseUrl();

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/callback`,
    },
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
