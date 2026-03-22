import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../lib/supabase/server";
import { uploadFile, deleteFile } from "../../../lib/storage/gcs";
import type { EntityType, AttachmentType } from "@repo/supabase";

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
    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { claims } = session;
    if (!claims.tenantId || !claims.profileId) {
      return NextResponse.json({ error: "Missing tenant or profile" }, { status: 403 });
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as EntityType | null;
    const entityId = formData.get("entityId") as string | null;
    const tenantId = formData.get("tenantId") as string | null;
    const category = formData.get("category") as string | null;

    if (!file || !entityType || !entityId || !tenantId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 });
    }

    // Be lenient with MIME types
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.type) || file.type === "" || file.type === "application/octet-stream";
    if (!mimeOk) {
      return NextResponse.json({ error: `File type "${file.type}" is not supported` }, { status: 400 });
    }

    // Determine attachment type
    let attachmentType: AttachmentType = "document";
    if (file.type.startsWith("image/")) {
      attachmentType = "photo";
    }

    const filePath = `documents/${tenantId}/${entityType}/${entityId}/${Date.now()}-${file.name}`;
    const contentType = file.type || "application/octet-stream";

    // Read file
    const arrayBuf = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuf);

    // Upload to GCS
    await uploadFile(filePath, fileBytes, contentType);

    // Create DB record
    const admin = createSupabaseAdmin();
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: attachment.id });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
