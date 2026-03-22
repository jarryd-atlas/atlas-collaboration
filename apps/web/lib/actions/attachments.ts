"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { uploadFile, deleteFile, getSignedUrl } from "../storage/gcs";
import type { EntityType, AttachmentType } from "@repo/supabase";

const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Other
  "application/zip",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Upload a document/file and create an attachment record.
 *
 * FormData fields:
 *  - file: File
 *  - entityType: EntityType (e.g. "site", "customer", "milestone", "task")
 *  - entityId: string (UUID of the entity)
 *  - tenantId: string
 *  - category: string (optional — stored in metadata JSONB)
 */
export async function uploadAttachment(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const file = formData.get("file") as File;
    const entityType = formData.get("entityType") as EntityType;
    const entityId = formData.get("entityId") as string;
    const tenantId = formData.get("tenantId") as string;
    const category = formData.get("category") as string | null;

    if (!file || !entityType || !entityId || !tenantId) {
      return { error: "Missing required fields" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: "File size exceeds 50MB limit" };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: `File type "${file.type}" is not supported` };
    }

    // Determine attachment type from mime type
    let attachmentType: AttachmentType = "document";
    if (file.type.startsWith("image/")) {
      attachmentType = "photo";
    }

    const admin = createSupabaseAdmin();

    // 1. Upload to GCS
    const filePath = `documents/${tenantId}/${entityType}/${entityId}/${Date.now()}-${file.name}`;
    const contentType = file.type || "application/octet-stream";

    // Convert to Uint8Array for Cloudflare Workers compatibility
    let fileBytes: Uint8Array;
    try {
      const ab = await file.arrayBuffer();
      fileBytes = new Uint8Array(ab);
    } catch {
      return { error: "Failed to read file data" };
    }

    try {
      await uploadFile(filePath, fileBytes, contentType);
    } catch (uploadErr) {
      return { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" };
    }

    // 2. Create attachments row
    const metadata: Record<string, string> = {};
    if (category) metadata.category = category;

    const { data: attachment, error: insertError } = await admin
      .from("attachments")
      .insert({
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        type: attachmentType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: contentType,
        uploaded_by: claims.profileId,
        metadata: metadata as unknown as Record<string, never>,
      })
      .select("id")
      .single();

    if (insertError) {
      // Clean up GCS file if DB insert fails
      await deleteFile(filePath).catch(() => {});
      return { error: insertError.message };
    }

    // Create consolidated upload notification
    // We use a debounced approach: check if there's a recent document_uploaded
    // notification for this entity from the last 60 seconds, and update it instead
    try {
      await createUploadNotification(admin, {
        tenantId,
        entityType,
        entityId,
        uploaderProfileId: claims.profileId,
        fileName: file.name,
      });
    } catch {
      // Non-critical: don't fail upload if notification fails
    }

    revalidatePath("/customers");
    return { id: attachment.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Delete an attachment and its storage file.
 */
export async function deleteAttachment(attachmentId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const admin = createSupabaseAdmin();

    // Get the attachment to find file_path
    const { data: attachment, error: fetchError } = await admin
      .from("attachments")
      .select("file_path, uploaded_by")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !attachment) {
      return { error: "Attachment not found" };
    }

    // Only uploader or CK internal can delete
    if (
      attachment.uploaded_by !== claims.profileId &&
      claims.tenantType !== "internal"
    ) {
      return { error: "You can only delete your own files" };
    }

    // Delete from GCS
    await deleteFile(attachment.file_path).catch(() => {});

    // Delete from DB
    const { error: deleteError } = await admin
      .from("attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) return { error: deleteError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Fetch attachments for a given entity. Server action to bypass RLS.
 */
export async function fetchAttachments(
  entityType: EntityType,
  entityId: string,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data, error } = await admin
      .from("attachments")
      .select("id, file_name, file_path, file_size, mime_type, type, metadata, created_at, uploaded_by, profiles:uploaded_by(full_name)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message, attachments: [] };

    // Generate GCS signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      (data ?? []).map(async (att) => {
        let url: string | null = null;
        try {
          url = await getSignedUrl(att.file_path, 3600); // 1 hour expiry
        } catch {
          // If signing fails, leave url null
        }

        const meta = (att.metadata ?? {}) as Record<string, unknown>;
        return {
          ...att,
          url,
          uploader_name: (att.profiles as any)?.full_name ?? "Unknown",
          category: (meta.category as string) ?? null,
          note: (meta.note as string) ?? null,
        };
      }),
    );

    return { attachments: attachmentsWithUrls };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch", attachments: [] };
  }
}

/**
 * Fetch all attachments for a customer (across all their sites + customer-level).
 */
export async function fetchCustomerAttachments(customerId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Get all site IDs for this customer
    const { data: sites } = await admin
      .from("sites")
      .select("id, name")
      .eq("customer_id", customerId);

    const siteIds = (sites ?? []).map((s) => s.id);
    const siteNames = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name]));

    // Fetch customer-level attachments + all site attachments
    const entityIds = [customerId, ...siteIds];

    const { data, error } = await admin
      .from("attachments")
      .select("id, file_name, file_path, file_size, mime_type, type, entity_type, entity_id, created_at, uploaded_by, profiles:uploaded_by(full_name)")
      .in("entity_id", entityIds)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message, attachments: [] };

    const attachmentsWithUrls = await Promise.all(
      (data ?? []).map(async (att) => {
        let url: string | null = null;
        try {
          url = await getSignedUrl(att.file_path, 3600);
        } catch {
          // If signing fails, leave url null
        }

        // Determine display context
        let context = "";
        if (att.entity_type === "customer") {
          context = "Customer";
        } else if (att.entity_type === "site") {
          context = siteNames[att.entity_id] ?? "Site";
        }

        return {
          ...att,
          url,
          uploader_name: (att.profiles as any)?.full_name ?? "Unknown",
          context,
        };
      }),
    );

    return { attachments: attachmentsWithUrls };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch", attachments: [] };
  }
}

/**
 * Update the category of an existing attachment.
 */
export async function updateAttachmentCategory(attachmentId: string, category: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const admin = createSupabaseAdmin();

    // Get existing metadata
    const { data: existing, error: fetchError } = await admin
      .from("attachments")
      .select("metadata, uploaded_by")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !existing) {
      return { error: "Attachment not found" };
    }

    // Only uploader or CK internal can update
    if (
      existing.uploaded_by !== claims.profileId &&
      claims.tenantType !== "internal"
    ) {
      return { error: "You can only edit your own files" };
    }

    const metadata = { ...(existing.metadata as Record<string, unknown> ?? {}), category };

    const { error: updateError } = await admin
      .from("attachments")
      .update({ metadata: metadata as unknown as Record<string, never> })
      .eq("id", attachmentId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Upload a new version of an existing document.
 * Links to the same version_group_id and increments version_number.
 */
export async function uploadNewVersion(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const file = formData.get("file") as File;
    const originalAttachmentId = formData.get("originalAttachmentId") as string;

    if (!file || !originalAttachmentId) {
      return { error: "Missing required fields" };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: "File size exceeds limit" };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { error: `File type "${file.type}" is not supported` };
    }

    const admin = createSupabaseAdmin();

    // Get the original attachment to inherit entity info and version group
    const { data: rawOriginal, error: fetchError } = await admin
      .from("attachments")
      .select("*")
      .eq("id", originalAttachmentId)
      .single();

    if (fetchError || !rawOriginal) {
      return { error: "Original attachment not found" };
    }

    // Cast to any for columns not yet in generated types (version_group_id, tenant_id)
    const original = rawOriginal as any;

    // Get current max version in this group
    const versionGroupId = original.version_group_id ?? original.id;
    const { data: versions } = await admin
      .from("attachments")
      .select("version_number")
      .eq("version_group_id", versionGroupId)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = ((versions?.[0] as any)?.version_number ?? 1) + 1;

    // Determine attachment type
    let attachmentType: AttachmentType = "document";
    if (file.type.startsWith("image/")) {
      attachmentType = "photo";
    }

    // Upload to GCS
    const filePath = `documents/${original.tenant_id}/${original.entity_type}/${original.entity_id}/${Date.now()}-${file.name}`;
    const contentType = file.type || "application/octet-stream";

    let fileBytes: Uint8Array;
    try {
      const ab = await file.arrayBuffer();
      fileBytes = new Uint8Array(ab);
    } catch {
      return { error: "Failed to read file data" };
    }

    try {
      await uploadFile(filePath, fileBytes, contentType);
    } catch (uploadErr) {
      return { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" };
    }

    // Inherit category from original
    const metadata = { ...(original.metadata as Record<string, unknown> ?? {}) };

    const { data: attachment, error: insertError } = await admin
      .from("attachments")
      .insert({
        tenant_id: original.tenant_id,
        entity_type: original.entity_type,
        entity_id: original.entity_id,
        type: attachmentType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: contentType,
        uploaded_by: claims.profileId,
        metadata: metadata as unknown as Record<string, never>,
        version_group_id: versionGroupId,
        version_number: nextVersion,
      } as any)
      .select("id")
      .single();

    if (insertError) {
      await deleteFile(filePath).catch(() => {});
      return { error: insertError.message };
    }

    // Ensure original also has the version_group_id set
    if (!original.version_group_id) {
      try {
        await admin
          .from("attachments")
          .update({ version_group_id: versionGroupId } as any)
          .eq("id", original.id);
      } catch {
        // Non-critical
      }
    }

    revalidatePath("/customers");
    return { id: attachment.id, versionNumber: nextVersion };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Fetch version history for a document (all versions in the same group).
 */
export async function fetchVersionHistory(attachmentId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Get the version_group_id
    const { data: att } = await admin
      .from("attachments")
      .select("version_group_id")
      .eq("id", attachmentId)
      .single();

    if (!att) return { versions: [] };

    const versionGroupId = (att as any).version_group_id;
    if (!versionGroupId) return { versions: [] };

    const { data: versions, error } = await admin
      .from("attachments")
      .select("id, file_name, file_size, created_at, version_number, uploaded_by, profiles:uploaded_by(full_name)")
      .eq("version_group_id", versionGroupId)
      .order("version_number", { ascending: false });

    if (error) return { versions: [] };

    return {
      versions: (versions ?? []).map((v: any) => ({
        id: v.id,
        file_name: v.file_name,
        file_size: v.file_size,
        created_at: v.created_at,
        version_number: v.version_number,
        uploader_name: v.profiles?.full_name ?? "Unknown",
      })),
    };
  } catch {
    return { versions: [] };
  }
}

/**
 * Update the file name of an attachment.
 */
export async function updateAttachmentFileName(attachmentId: string, fileName: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const trimmed = fileName.trim();
    if (!trimmed) {
      return { error: "File name cannot be empty" };
    }

    const admin = createSupabaseAdmin();

    // Check ownership
    const { data: existing, error: fetchError } = await admin
      .from("attachments")
      .select("uploaded_by")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !existing) {
      return { error: "Attachment not found" };
    }

    if (
      existing.uploaded_by !== claims.profileId &&
      claims.tenantType !== "internal"
    ) {
      return { error: "You can only edit your own files" };
    }

    const { error: updateError } = await admin
      .from("attachments")
      .update({ file_name: trimmed })
      .eq("id", attachmentId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update the note on an attachment (stored in metadata.note).
 */
export async function updateAttachmentNote(attachmentId: string, note: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const admin = createSupabaseAdmin();

    const { data: existing, error: fetchError } = await admin
      .from("attachments")
      .select("metadata, uploaded_by")
      .eq("id", attachmentId)
      .single();

    if (fetchError || !existing) {
      return { error: "Attachment not found" };
    }

    if (
      existing.uploaded_by !== claims.profileId &&
      claims.tenantType !== "internal"
    ) {
      return { error: "You can only edit your own files" };
    }

    const metadata: Record<string, unknown> = { ...(existing.metadata as Record<string, unknown> ?? {}), note: note.trim() };
    // Remove note key if empty
    if (!metadata.note) delete metadata.note;

    const { error: updateError } = await admin
      .from("attachments")
      .update({ metadata: metadata as unknown as Record<string, never> })
      .eq("id", attachmentId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Internal helpers ──────────────────────────────────────

/**
 * Create or consolidate an upload notification.
 * If a recent (last 60s) upload notification exists for the same entity + uploader,
 * update it to reflect the new file count instead of creating separate notifications.
 */
async function createUploadNotification(
  admin: ReturnType<typeof createSupabaseAdmin>,
  opts: {
    tenantId: string;
    entityType: EntityType;
    entityId: string;
    uploaderProfileId: string;
    fileName: string;
  },
) {
  const { tenantId, entityType, entityId, uploaderProfileId, fileName } = opts;

  // Get the uploader's name
  const { data: uploader } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", uploaderProfileId)
    .single();

  const uploaderName = (uploader as any)?.full_name ?? "Someone";

  // Get entity display name
  let entityName = "";
  if (entityType === "site") {
    const { data: site } = await admin.from("sites").select("name").eq("id", entityId).single();
    entityName = (site as any)?.name ?? "a site";
  } else if (entityType === "customer") {
    const { data: cust } = await admin.from("customers").select("name").eq("id", entityId).single();
    entityName = (cust as any)?.name ?? "a company";
  } else if (entityType === "milestone") {
    const { data: ms } = await admin.from("milestones").select("name").eq("id", entityId).single();
    entityName = (ms as any)?.name ?? "a milestone";
  }

  // Check for a recent notification from the same uploader for the same entity (within 60s)
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await admin
    .from("notifications")
    .select("id, title, body")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("type", "document_uploaded" as any)
    .gte("created_at", cutoff)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  // Get users to notify: all active profiles in the tenant (except uploader)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .neq("id", uploaderProfileId);

  const profileIds = (profiles ?? []).map((p: any) => p.id);
  if (profileIds.length === 0) return;

  if (recent && recent.length > 0) {
    // Consolidate: update existing notifications to reflect more files
    const existing = recent[0] as any;
    const currentBody = (existing.body ?? "") as string;
    const fileCountMatch = currentBody.match(/(\d+) document/);
    const currentCount = fileCountMatch?.[1] ? parseInt(fileCountMatch[1], 10) : 1;
    const newCount = currentCount + 1;

    const newTitle = `${uploaderName} uploaded ${newCount} documents to ${entityName}`;
    const newBody = `${newCount} documents uploaded`;

    await admin
      .from("notifications")
      .update({ title: newTitle, body: newBody })
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("type", "document_uploaded" as any)
      .gte("created_at", cutoff)
      .is("read_at", null);
  } else {
    // Create new notification for each user
    const notifications = profileIds.map((userId: string) => ({
      tenant_id: tenantId,
      user_id: userId,
      type: "document_uploaded" as any,
      entity_type: entityType,
      entity_id: entityId,
      title: `${uploaderName} uploaded a document to ${entityName}`,
      body: `1 document uploaded: ${fileName}`,
    }));

    await admin.from("notifications").insert(notifications);
  }
}
