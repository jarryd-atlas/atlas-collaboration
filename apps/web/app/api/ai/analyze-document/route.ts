import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";
import { downloadFile } from "../../../../lib/storage/gcs";
import { extractBaseline } from "@repo/ai";
// XLSX imported dynamically to avoid module-level crashes on Workers

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
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await downloadFile(attachment.file_path);
    } catch (dlErr) {
      return NextResponse.json(
        { error: `GCS download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}` },
        { status: 500 },
      );
    }

    // Convert to appropriate format for Claude
    let content: string;
    let mimeType = attachment.mime_type || "application/octet-stream";
    const fileName = attachment.file_name || "";

    // Spreadsheet files (.xlsx, .xls, .xlsm) — convert to CSV text
    const isSpreadsheet =
      mimeType.includes("spreadsheetml") ||
      mimeType.includes("ms-excel") ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      /\.xlsx?$|\.xlsm$/i.test(fileName);

    if (isSpreadsheet) {
      // Parse Excel to CSV using SheetJS (dynamic import for Workers compat)
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
      const csvParts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        csvParts.push(`=== Sheet: ${sheetName} ===`);
        csvParts.push(XLSX.utils.sheet_to_csv(sheet));
      }
      content = csvParts.join("\n\n");
      // Treat as text for the AI extraction
      mimeType = "text/csv";
    } else if (
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
    let extraction;
    try {
      extraction = await extractBaseline(
        content,
        mimeType,
        attachment.file_name,
      );
    } catch (aiErr) {
      return NextResponse.json(
        { error: `AI extraction failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}` },
        { status: 500 },
      );
    }

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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 3).join(" | ") : "";
    console.error("Document analysis error:", message, stack);
    return NextResponse.json(
      { error: message, detail: stack },
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
