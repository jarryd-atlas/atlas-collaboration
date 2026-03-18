"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { UserRole } from "@repo/supabase";

export async function inviteUser(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    throw new Error("Forbidden: admin only");
  }

  const email = formData.get("email") as string;
  const tenantId = formData.get("tenantId") as string;
  const role = (formData.get("role") as UserRole) || "member";
  const fullName = (formData.get("fullName") as string) || email.split("@")[0]!;

  const admin = createSupabaseAdmin();

  // Check if profile already exists for this email
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) throw new Error("User already exists with this email");

  // Pre-create profile with null user_id (invite flow)
  const { error } = await admin.from("profiles").insert({
    user_id: null,
    tenant_id: tenantId,
    role,
    status: "pending",
    full_name: fullName,
    email,
  });

  if (error) throw error;

  // TODO: Send invite email via Resend (Phase 3)

  revalidatePath("/admin/users");
}

export async function approveUser(profileId: string) {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    throw new Error("Forbidden: admin only");
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId);

  if (error) throw error;

  revalidatePath("/admin/users");
}

export async function denyUser(profileId: string) {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    throw new Error("Forbidden: admin only");
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ status: "disabled" })
    .eq("id", profileId);

  if (error) throw error;

  revalidatePath("/admin/users");
}

export async function updateUserRole(profileId: string, role: UserRole) {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin") {
    throw new Error("Forbidden: super_admin only");
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profileId);

  if (error) throw error;

  revalidatePath("/admin/users");
}
