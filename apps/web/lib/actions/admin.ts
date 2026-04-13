"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { UserRole } from "@repo/supabase";

export async function inviteUser(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
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

    if (existing) return { error: "User already exists with this email" };

    // Pre-create profile with null user_id (invite flow)
    const { error: dbError } = await admin.from("profiles").insert({
      user_id: null,
      tenant_id: tenantId,
      role,
      status: "pending",
      full_name: fullName,
      email,
    });

    if (dbError) return { error: dbError.message };

    // TODO: Send invite email via Resend (Phase 3)

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function approveUser(profileId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("profiles")
      .update({ status: "active" })
      .eq("id", profileId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function denyUser(profileId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("profiles")
      .update({ status: "disabled" })
      .eq("id", profileId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateUserProfile(
  profileId: string,
  updates: { role?: UserRole; title?: string | null; team?: string | null },
) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    // Only super_admin can change roles
    if (updates.role && claims.appRole !== "super_admin") {
      return { error: "Forbidden: only super_admin can change roles" };
    }

    const admin = createSupabaseAdmin();
    const patch: Record<string, unknown> = {};
    if (updates.role !== undefined) patch.role = updates.role;
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.team !== undefined) patch.team = updates.team;

    if (Object.keys(patch).length === 0) return { success: true };

    const { error: dbError } = await admin
      .from("profiles")
      .update(patch as any)
      .eq("id", profileId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateUserRole(profileId: string, role: UserRole) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin") {
      return { error: "Forbidden: super_admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", profileId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
