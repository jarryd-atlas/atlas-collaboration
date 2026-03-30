import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { downloadFile } from "../../../../lib/storage/gcs";

/**
 * Proxy endpoint to download files from GCS.
 * Avoids CORS issues when the browser needs to fetch files for client-side processing
 * (e.g., rendering PDFs as images for AI analysis).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { attachmentId } = await params;

    const admin = createSupabaseAdmin();
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
