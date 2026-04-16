"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { DISCOVERY_SECTIONS, DISCOVERY_SECTION_LABELS, SECTION_STATUS_LABELS } from "@repo/shared";
import type { DiscoverySection, SectionStatus } from "@repo/shared";
import { logActivity, getCustomerIdForSite } from "./activity";

// NOTE: section_statuses table is not in generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

// ═══════════════════════════════════════════════════════════════
// Section Status CRUD
// ═══════════════════════════════════════════════════════════════

/** Seed section_statuses rows for all discovery sections (idempotent). */
export async function seedSectionStatuses(
  assessmentId: string,
  siteId: string,
  tenantId: string
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Check if any already exist
    const { data: existing } = await fromTable(admin, "section_statuses")
      .select("section_key")
      .eq("assessment_id", assessmentId);

    const existingKeys = new Set((existing ?? []).map((r: any) => r.section_key));

    const toInsert = DISCOVERY_SECTIONS
      .filter((key) => !existingKeys.has(key))
      .map((key) => ({
        assessment_id: assessmentId,
        site_id: siteId,
        tenant_id: tenantId,
        section_key: key,
        status: "not_started",
      }));

    if (toInsert.length > 0) {
      const { error } = await fromTable(admin, "section_statuses")
        .insert(toInsert);
      if (error) return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

/** Update the status of a section (and optionally assign it). */
export async function updateSectionStatus(
  assessmentId: string,
  sectionKey: DiscoverySection,
  status: SectionStatus,
  assigneeId?: string | null
) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();

    const profileId = session.claims?.profileId ?? null;

    // Get old status for activity log
    const { data: existing } = await fromTable(admin, "section_statuses")
      .select("status, site_id, tenant_id")
      .eq("assessment_id", assessmentId)
      .eq("section_key", sectionKey)
      .single();

    const oldStatus = existing?.status;

    const updateData: Record<string, any> = {
      status,
      updated_by: profileId,
      updated_at: new Date().toISOString(),
    };

    // Only update assignee if explicitly provided
    if (assigneeId !== undefined) {
      updateData.assignee_id = assigneeId;
    }

    const { error } = await fromTable(admin, "section_statuses")
      .update(updateData)
      .eq("assessment_id", assessmentId)
      .eq("section_key", sectionKey);

    if (error) return { error: error.message };

    // Log activity
    if (profileId && existing) {
      const customerId = await getCustomerIdForSite(existing.site_id);
      await logActivity({
        tenantId: existing.tenant_id,
        actorId: profileId,
        entityType: "section_status",
        entityId: assessmentId,
        action: "status_changed",
        changes: {
          section: sectionKey,
          section_label: DISCOVERY_SECTION_LABELS[sectionKey] ?? sectionKey,
          old_status: oldStatus,
          new_status: status,
        },
        siteId: existing.site_id,
        customerId,
      });
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Information Requests
// ═══════════════════════════════════════════════════════════════

/** Create a new information request (CK → customer). */
export async function createInformationRequest(data: {
  siteId: string;
  tenantId: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  sectionKey?: string;
  assignedTo?: string;
}) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();
    const profileId = session.claims?.profileId;
    if (!profileId) return { error: "Profile not found" };

    const { data: row, error } = await fromTable(admin, "information_requests")
      .insert({
        site_id: data.siteId,
        tenant_id: data.tenantId,
        title: data.title,
        description: data.description || null,
        priority: data.priority || "medium",
        section_key: data.sectionKey || null,
        assigned_to: data.assignedTo || null,
        requested_by: profileId,
        status: "open",
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Log activity (customer-visible)
    const customerId = await getCustomerIdForSite(data.siteId);
    await logActivity({
      tenantId: data.tenantId,
      actorId: profileId,
      entityType: "info_request",
      entityId: row.id,
      action: "created",
      changes: { title: data.title },
      siteId: data.siteId,
      customerId,
      customerVisible: true,
    });

    revalidatePath("/customers");
    return { success: true, request: row };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

/** Update an information request status. */
export async function updateInformationRequestStatus(
  requestId: string,
  status: "open" | "responded" | "resolved"
) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();
    const profileId = session.claims?.profileId;

    // Get request details for activity log
    const { data: request } = await fromTable(admin, "information_requests")
      .select("title, site_id, tenant_id")
      .eq("id", requestId)
      .single();

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "resolved") {
      updateData.resolved_by = profileId;
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await fromTable(admin, "information_requests")
      .update(updateData)
      .eq("id", requestId);

    if (error) return { error: error.message };

    // Log activity (customer-visible)
    if (profileId && request) {
      const customerId = await getCustomerIdForSite(request.site_id);
      await logActivity({
        tenantId: request.tenant_id,
        actorId: profileId,
        entityType: "info_request",
        entityId: requestId,
        action: status === "resolved" ? "resolved" : "status_changed",
        changes: { title: request.title, new_status: status },
        siteId: request.site_id,
        customerId,
        customerVisible: true,
      });
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

/** Mark a request as responded (called when customer adds a comment). */
export async function markRequestResponded(requestId: string) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();
    const profileId = session.claims?.profileId;

    // Get request details for activity log
    const { data: request } = await fromTable(admin, "information_requests")
      .select("title, site_id, tenant_id, status")
      .eq("id", requestId)
      .single();

    // Only mark as responded if currently open
    const { error } = await fromTable(admin, "information_requests")
      .update({
        status: "responded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("status", "open");

    if (error) return { error: error.message };

    // Log activity (customer-visible)
    if (profileId && request && request.status === "open") {
      const customerId = await getCustomerIdForSite(request.site_id);
      await logActivity({
        tenantId: request.tenant_id,
        actorId: profileId,
        entityType: "info_request",
        entityId: requestId,
        action: "responded",
        changes: { title: request.title },
        siteId: request.site_id,
        customerId,
        customerVisible: true,
      });
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Output Sharing
// ═══════════════════════════════════════════════════════════════

/** Toggle sharing a section with the customer. */
export async function toggleOutputSharing(
  siteId: string,
  tenantId: string,
  sectionKey: string,
  shared: boolean
) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();
    const profileId = session.claims?.profileId;
    if (!profileId) return { error: "Profile not found" };

    if (shared) {
      // Revoke any existing active share first (idempotent)
      await fromTable(admin, "output_sharing_permissions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("site_id", siteId)
        .eq("section_key", sectionKey)
        .is("revoked_at", null);

      // Create new share
      const { error } = await fromTable(admin, "output_sharing_permissions")
        .insert({
          site_id: siteId,
          tenant_id: tenantId,
          section_key: sectionKey,
          shared_by: profileId,
        });

      if (error) return { error: error.message };
    } else {
      // Revoke the share
      const { error } = await fromTable(admin, "output_sharing_permissions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("site_id", siteId)
        .eq("section_key", sectionKey)
        .is("revoked_at", null);

      if (error) return { error: error.message };
    }

    // Log activity
    const customerId = await getCustomerIdForSite(siteId);
    await logActivity({
      tenantId,
      actorId: profileId,
      entityType: "section_status",
      entityId: siteId,
      action: shared ? "shared" : "unshared",
      changes: {
        section: sectionKey,
        section_label: DISCOVERY_SECTION_LABELS[sectionKey as DiscoverySection] ?? sectionKey,
      },
      siteId,
      customerId,
    });

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Section Assignment
// ═══════════════════════════════════════════════════════════════

/** Assign a team member to a section. */
export async function assignSection(
  assessmentId: string,
  sectionKey: DiscoverySection,
  assigneeId: string | null
) {
  try {
    const session = await requireSession();
    const admin = createSupabaseAdmin();

    const profileId = session.claims?.profileId ?? null;

    // Get section details for activity log
    const { data: existing } = await fromTable(admin, "section_statuses")
      .select("site_id, tenant_id")
      .eq("assessment_id", assessmentId)
      .eq("section_key", sectionKey)
      .single();

    const { error } = await fromTable(admin, "section_statuses")
      .update({
        assignee_id: assigneeId,
        updated_by: profileId,
        updated_at: new Date().toISOString(),
      })
      .eq("assessment_id", assessmentId)
      .eq("section_key", sectionKey);

    if (error) return { error: error.message };

    // Log activity — look up assignee name
    if (profileId && existing) {
      let assigneeName = "someone";
      if (assigneeId) {
        const { data: assigneeProfile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", assigneeId)
          .single();
        assigneeName = (assigneeProfile as any)?.full_name ?? "someone";
      }

      const customerId = await getCustomerIdForSite(existing.site_id);
      await logActivity({
        tenantId: existing.tenant_id,
        actorId: profileId,
        entityType: "section_status",
        entityId: assessmentId,
        action: "assigned",
        changes: {
          section: sectionKey,
          section_label: DISCOVERY_SECTION_LABELS[sectionKey] ?? sectionKey,
          assignee_name: assigneeName,
        },
        siteId: existing.site_id,
        customerId,
      });
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
