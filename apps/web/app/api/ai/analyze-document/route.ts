import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";
import { downloadFile } from "../../../../lib/storage/gcs";
import { extractBaseline } from "@repo/ai";

/**
 * POST /api/ai/analyze-document
 * Analyzes an uploaded document with Claude to extract baseline assessment data.
 * Only accessible by CK internal users.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check — must be internal user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Only CK users can analyze documents" }, { status: 403 });
    }

    const { attachmentId, siteId } = await req.json();

    if (!attachmentId || !siteId) {
      return NextResponse.json(
        { error: "attachmentId and siteId are required" },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdmin();

    // Look up the attachment
    const { data: attachment, error: attachErr } = await admin
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (attachErr || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Look up the site to get tenant_id
    const { data: siteRow } = await admin
      .from("sites")
      .select("tenant_id")
      .eq("id", siteId)
      .single();

    const tenantId = siteRow?.tenant_id;

    // Look up the assessment for this site
    const { data: assessment } = await (admin as any)
      .from("site_assessments")
      .select("id")
      .eq("site_id", siteId)
      .single();

    // Download the file from GCS
    const fileBuffer = await downloadFile(attachment.file_path);

    // Convert to base64 for Claude vision (images/PDFs)
    // or to text for text-based documents
    let content: string;
    const mimeType = attachment.mime_type || "application/octet-stream";

    if (
      mimeType.startsWith("text/") ||
      mimeType === "application/csv" ||
      mimeType === "text/csv"
    ) {
      // Text documents — send as plain text
      content = new TextDecoder().decode(fileBuffer);
    } else {
      // Binary documents (PDFs, images) — send as base64
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      content = btoa(binary);
    }

    // Call Claude to extract baseline data
    const extraction = await extractBaseline(
      content,
      mimeType,
      attachment.file_name,
    );

    // Create a document_extractions record
    const { data: extractionRecord, error: extErr } = await (admin as any)
      .from("document_extractions")
      .insert({
        attachment_id: attachmentId,
        site_id: siteId,
        tenant_id: tenantId,
        assessment_id: assessment?.id || null,
        document_type: guessDocumentType(attachment.file_name, extraction.sectionsFound),
        status: "review",
        extracted_data: extraction,
        confidence: extraction.confidence,
      })
      .select()
      .single();

    if (extErr) {
      console.error("Failed to save extraction:", extErr);
      return NextResponse.json(
        { error: "Failed to save extraction record" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      extractionId: extractionRecord.id,
      extraction,
    });
  } catch (err) {
    console.error("Document analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze document" },
      { status: 500 },
    );
  }
}

function guessDocumentType(
  fileName: string,
  sectionsFound: string[],
): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("bill") || lower.includes("utility") || lower.includes("invoice")) {
    return "utility_bill";
  }
  if (lower.includes("p&id") || lower.includes("pid") || lower.includes("diagram")) {
    return "p_and_id";
  }
  if (lower.includes("round") || lower.includes("log")) {
    return "round_sheet";
  }
  if (lower.includes("interval") || lower.includes("kwh") || lower.includes("demand")) {
    return "interval_data";
  }
  if (sectionsFound.includes("equipment")) return "equipment_list";
  if (sectionsFound.includes("energyData")) return "utility_bill";
  return "other";
}
