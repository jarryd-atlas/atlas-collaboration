import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";
import { uploadFile, deleteFile } from "../../../../lib/storage/gcs";
import type { AttachmentType } from "@repo/supabase";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/zip",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { claims } = session;
    if (!claims.tenantId || !claims.profileId) {
      return NextResponse.json({ error: "Missing tenant or profile" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const originalAttachmentId = formData.get("originalAttachmentId") as string | null;

    if (!file || !originalAttachmentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 });
    }

    const mimeOk = ALLOWED_MIME_TYPES.includes(file.type) || file.type === "" || file.type === "application/octet-stream";
    if (!mimeOk) {
      return NextResponse.json({ error: `File type "${file.type}" is not supported` }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // Get original attachment
    const { data: rawOriginal, error: fetchError } = await admin
      .from("attachments")
      .select("*")
      .eq("id", originalAttachmentId)
      .single();

    if (fetchError || !rawOriginal) {
      return NextResponse.json({ error: "Original attachment not found" }, { status: 404 });
    }

    // Cast to any for columns not yet in generated types (version_group_id, tenant_id)
    const original = rawOriginal as any;

    // Get version group and next version number
    const versionGroupId = original.version_group_id ?? original.id;
    const { data: versions } = await admin
      .from("attachments")
      .select("version_number" as any)
      .eq("version_group_id" as any, versionGroupId)
      .order("version_number" as any, { ascending: false })
      .limit(1);

    const nextVersion = ((versions?.[0] as any)?.version_number ?? 1) + 1;

    // Determine attachment type
    let attachmentType: AttachmentType = "document";
    if (file.type.startsWith("image/")) {
      attachmentType = "photo";
    }

    const filePath = `documents/${original.tenant_id}/${original.entity_type}/${original.entity_id}/${Date.now()}-${file.name}`;
    const contentType = file.type || "application/octet-stream";

    const arrayBuf = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuf);

    await uploadFile(filePath, fileBytes, contentType);

    // Inherit metadata from original
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Ensure original also has version_group_id set
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

    return NextResponse.json({ id: attachment.id, versionNumber: nextVersion });
  } catch (err) {
    console.error("Version upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
