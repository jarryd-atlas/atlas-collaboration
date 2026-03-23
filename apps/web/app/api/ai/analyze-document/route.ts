import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";
import { downloadFile } from "../../../../lib/storage/gcs";
import { extractBaseline } from "@repo/ai";
import { applyExtraction } from "../../../../lib/ai/apply-extraction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * POST /api/ai/analyze-document
 * Analyzes an uploaded document with Claude, auto-applies extracted data to baseline,
 * and saves an AI summary on the file. No review step required.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Only CK users can analyze documents" }, { status: 403 });
    }

    const { attachmentId, siteId } = await req.json();
    if (!attachmentId || !siteId) {
      return NextResponse.json({ error: "attachmentId and siteId are required" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // 1. Look up the attachment
    const { data: attachment, error: attachErr } = await admin
      .from("attachments")
      .select("*")
      .eq("id", attachmentId)
      .single();

    if (attachErr || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // 2. Look up site + assessment
    const { data: siteRow } = await admin
      .from("sites")
      .select("tenant_id")
      .eq("id", siteId)
      .single();

    const tenantId = siteRow?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Ensure assessment exists (create if needed)
    let { data: assessment } = await fromTable(admin, "site_assessments")
      .select("id")
      .eq("site_id", siteId)
      .single();

    if (!assessment) {
      const { data: newAssessment } = await fromTable(admin, "site_assessments")
        .insert({ site_id: siteId, tenant_id: tenantId, status: "in_progress" })
        .select("id")
        .single();
      assessment = newAssessment;
    }

    if (!assessment) {
      return NextResponse.json({ error: "Could not create assessment" }, { status: 500 });
    }

    // 3. Load category-specific AI instructions
    const category = (attachment.metadata as Record<string, unknown>)?.category as string | undefined;
    let categoryInstructions: string | undefined;
    if (category) {
      const { data: catInstr } = await fromTable(admin, "ai_category_instructions")
        .select("instructions")
        .eq("tenant_id", tenantId)
        .eq("category_key", category)
        .eq("is_active", true)
        .maybeSingle();
      categoryInstructions = catInstr?.instructions as string | undefined;
    }

    // 4. Download file from GCS
    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await downloadFile(attachment.file_path);
    } catch (dlErr) {
      return NextResponse.json(
        { error: `GCS download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}` },
        { status: 500 },
      );
    }

    // 5. Convert to appropriate format for Claude
    let content: string;
    let mimeType = attachment.mime_type || "application/octet-stream";
    const fileName = attachment.file_name || "";

    const isSpreadsheet =
      mimeType.includes("spreadsheetml") ||
      mimeType.includes("ms-excel") ||
      mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      /\.xlsx?$|\.xlsm$/i.test(fileName);

    if (isSpreadsheet) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
      const csvParts: string[] = [];
      let totalRows = 0;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const lines = csv.split("\n");
        totalRows += lines.length;
        csvParts.push(`=== Sheet: ${sheetName} (${lines.length} rows) ===`);
        csvParts.push(csv);
      }
      content = csvParts.join("\n\n");

      // Large spreadsheets (>500K chars ≈ 125K tokens) — smart truncation
      // Keep header rows + first/last samples from each sheet so Claude sees the structure
      const MAX_CHARS = 400_000; // ~100K tokens, safe under 200K limit with system prompt
      if (content.length > MAX_CHARS) {
        const truncatedParts: string[] = [];
        truncatedParts.push(`[NOTE: Original file has ${totalRows} rows across ${workbook.SheetNames.length} sheet(s). Showing representative samples for extraction.]`);
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const csv = XLSX.utils.sheet_to_csv(sheet);
          const lines = csv.split("\n");
          if (lines.length <= 200) {
            truncatedParts.push(`=== Sheet: ${sheetName} (${lines.length} rows, complete) ===`);
            truncatedParts.push(csv);
          } else {
            // Header + first 100 rows + last 50 rows
            const header = lines.slice(0, 1);
            const firstBlock = lines.slice(1, 101);
            const lastBlock = lines.slice(-50);
            truncatedParts.push(`=== Sheet: ${sheetName} (${lines.length} rows, sampled) ===`);
            truncatedParts.push([...header, ...firstBlock].join("\n"));
            truncatedParts.push(`\n... [${lines.length - 151} rows omitted] ...\n`);
            truncatedParts.push(lastBlock.join("\n"));
          }
        }
        content = truncatedParts.join("\n\n");
      }
      mimeType = "text/csv";
    } else if (
      mimeType.startsWith("text/") ||
      mimeType === "application/csv" ||
      mimeType === "text/csv"
    ) {
      content = new TextDecoder().decode(fileBuffer);
    } else {
      const bytes = new Uint8Array(fileBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      content = btoa(binary);
    }

    // 6. Call Claude with category instructions
    let extraction;
    try {
      extraction = await extractBaseline(content, mimeType, fileName, categoryInstructions);
    } catch (aiErr) {
      return NextResponse.json(
        { error: `AI extraction failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}` },
        { status: 500 },
      );
    }

    // 7. Save extraction record (status: accepted — auto-applied)
    const { data: extractionRecord, error: extErr } = await fromTable(admin, "document_extractions")
      .insert({
        attachment_id: attachmentId,
        site_id: siteId,
        tenant_id: tenantId,
        assessment_id: assessment.id,
        document_type: guessDocumentType(fileName, extraction.sectionsFound),
        status: "accepted",
        extracted_data: extraction,
        confidence: extraction.confidence,
        reviewed_by: session.claims.profileId,
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (extErr || !extractionRecord) {
      console.error("Failed to save extraction:", extErr);
      return NextResponse.json({ error: "Failed to save extraction record" }, { status: 500 });
    }

    // 8. Auto-apply all extracted sections to baseline tables
    let appliedSections: string[] = [];
    try {
      appliedSections = await applyExtraction({
        extractionId: extractionRecord.id as string,
        assessmentId: assessment.id as string,
        siteId,
        tenantId,
        attachmentId,
        data: extraction,
        reviewedBy: session.claims.profileId,
      });
    } catch (applyErr) {
      console.error("Auto-apply failed:", applyErr);
      // Don't fail the whole request — extraction is saved, apply can be retried
    }

    // 9. Save AI summary to attachment metadata
    const summary = extraction.summary || `Extracted: ${extraction.sectionsFound.join(", ")}`;
    const existingMetadata = (attachment.metadata || {}) as Record<string, unknown>;
    await admin
      .from("attachments")
      .update({
        metadata: { ...existingMetadata, ai_summary: summary },
      })
      .eq("id", attachmentId);

    return NextResponse.json({
      extractionId: extractionRecord.id,
      summary,
      sectionsApplied: appliedSections,
      confidence: extraction.confidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Document analysis error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function guessDocumentType(fileName: string, sectionsFound: string[]): string {
  const lower = fileName.toLowerCase();
  if (lower.includes("bill") || lower.includes("utility") || lower.includes("invoice")) return "utility_bill";
  if (lower.includes("p&id") || lower.includes("pid") || lower.includes("diagram")) return "p_and_id";
  if (lower.includes("round") || lower.includes("log")) return "round_sheet";
  if (lower.includes("interval") || lower.includes("kwh") || lower.includes("demand")) return "interval_data";
  if (sectionsFound.includes("equipment")) return "equipment_list";
  if (sectionsFound.includes("energyData")) return "utility_bill";
  return "other";
}
