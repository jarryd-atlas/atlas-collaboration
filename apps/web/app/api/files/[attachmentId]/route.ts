import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { downloadFile } from "../../../../lib/storage/gcs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * Proxy endpoint to download files from GCS.
 * Supports both session auth and token-based auth (for baseline form).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await getSession();
    const token = request.nextUrl.searchParams.get("token");

    if (!session && !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attachmentId } = await params;

    const admin = createSupabaseAdmin();

    // If using token auth, validate the token and ensure the attachment belongs to the same site
    if (!session && token) {
      const { data: interview } = await fromTable(admin, "assessment_interviews")
        .select("id, site_id")
        .eq("invite_token", token)
        .single();

      if (!interview) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }

      const { data: att, error } = await admin
        .from("attachments")
        .select("file_path, mime_type, file_name")
        .eq("id", attachmentId)
        .eq("entity_type", "site")
        .eq("entity_id", interview.site_id)
        .single();

      if (error || !att) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }

      const buffer = await downloadFile(att.file_path);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": att.mime_type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${att.file_name || "file"}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const { data: att, error } = await admin
      .from("attachments")
      .select("file_path, mime_type, file_name")
      .eq("id", attachmentId)
      .single();

    if (error || !att) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const buffer = await downloadFile(att.file_path);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": att.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${att.file_name || "file"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to download file" },
      { status: 500 }
    );
  }
}
