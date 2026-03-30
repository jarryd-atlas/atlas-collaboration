"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export type FeedbackCategory = "bug" | "feature_request" | "improvement" | "other";
export type FeedbackStatus = "new" | "reviewed" | "planned" | "done" | "dismissed";

export interface FeedbackRow {
  id: string;
  tenant_id: string;
  submitted_by: string | null;
  category: FeedbackCategory;
  message: string;
  page_url: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  /** joined from profiles */
  submitter_name?: string;
  submitter_email?: string;
}

export async function submitFeedback(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId || !claims.tenantId) {
      return { error: "Not authenticated" };
    }

    const category = (formData.get("category") as FeedbackCategory) || "other";
    const message = formData.get("message") as string;
    const pageUrl = (formData.get("pageUrl") as string) || null;

    if (!message?.trim()) return { error: "Message is required" };

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "feedback").insert({
      tenant_id: claims.tenantId,
      submitted_by: claims.profileId,
      category,
      message: message.trim(),
      page_url: pageUrl,
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function fetchAllFeedback(): Promise<{ feedback: FeedbackRow[]; error?: string }> {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { feedback: [], error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data, error: dbError } = await fromTable(admin, "feedback")
      .select("*, profiles:submitted_by(full_name, email)")
      .order("created_at", { ascending: false });

    if (dbError) return { feedback: [], error: dbError.message };

    const feedback = (data ?? []).map((row: any) => ({
      ...row,
      submitter_name: row.profiles?.full_name ?? null,
      submitter_email: row.profiles?.email ?? null,
      profiles: undefined,
    }));

    return { feedback };
  } catch (err) {
    return { feedback: [], error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminNotes?: string
) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const update: Record<string, unknown> = { status };
    if (adminNotes !== undefined) {
      update.admin_notes = adminNotes;
    }

    const { error: dbError } = await fromTable(admin, "feedback")
      .update(update)
      .eq("id", feedbackId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
