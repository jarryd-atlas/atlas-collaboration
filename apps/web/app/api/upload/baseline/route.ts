import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * Token-based upload endpoint for the baseline form.
 * Validates via invite_token instead of session auth.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const token = formData.get("token") as string | null;
    const profileId = formData.get("profileId") as string | null;
    const category = formData.get("category") as string | null;

    if (!file || !token || !profileId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate token
    const admin = createSupabaseAdmin();
    const { data: interview } = await fromTable(admin, "assessment_interviews")
      .select("id, assessment_id, site_id, tenant_id, status")
      .eq("invite_token", token)
      .single();

    if (!interview) {
      return NextResponse.json({ error: "Invalid or expired form link" }, { status: 401 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 });
    }

    const mimeOk =
      ALLOWED_MIME_TYPES.includes(file.type) ||
      file.type === "" ||
      file.type === "application/octet-stream";
    if (!mimeOk) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not supported` },
        { status: 400 },
      );
    }

    let attachmentType: AttachmentType = "document";
    if (file.type.startsWith("image/")) {
      attachmentType = "photo";
    }

    const filePath = `documents/${interview.tenant_id}/site/${interview.site_id}/${Date.now()}-${file.name}`;
    const contentType = file.type || "application/octet-stream";

    const arrayBuf = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuf);

    await uploadFile(filePath, fileBytes, contentType);

    const metadata: Record<string, string> = { source: "baseline_form" };
    if (category) metadata.category = category;

    const { data: attachment, error: insertError } = await admin
      .from("attachments")
      .insert({
        tenant_id: interview.tenant_id,
        entity_type: "site" as const,
        entity_id: interview.site_id,
        type: attachmentType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: contentType,
        uploaded_by: profileId,
        metadata: metadata as unknown as Record<string, never>,
      })
      .select("id, file_name, file_size, mime_type, type, created_at, metadata")
      .single();

    if (insertError) {
      await deleteFile(filePath).catch(() => {});
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: attachment.id,
      file_name: attachment.file_name,
      file_size: attachment.file_size,
      mime_type: attachment.mime_type,
      type: attachment.type,
      created_at: attachment.created_at,
      category: (attachment.metadata as Record<string, string>)?.category ?? null,
    });
  } catch (err) {
    console.error("Baseline upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
