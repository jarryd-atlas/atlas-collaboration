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
 * Receives pre-processed content from the browser (text/CSV for spreadsheets,
 * base64 for PDFs/images), calls Claude, auto-applies to baseline, saves summary.
 *
 * The browser handles file download from GCS + xlsx parsing + PDF encoding.
 * This route is lightweight — just Claude API + DB writes.
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

    const { attachmentId, siteId, content: clientContent, mimeType: clientMimeType, fileName, category } = await req.json();
    if (!attachmentId || !siteId) {
      return NextResponse.json({ error: "attachmentId and siteId are required" }, { status: 400 });
    }

    // For PDFs/images, client sends no content — we download from GCS server-side
    // (lightweight fetch, no CPU-heavy parsing needed)
    let content = clientContent as string | undefined;
    let mimeType = clientMimeType as string | undefined;

    const admin = createSupabaseAdmin();

    // 1. Look up site tenant_id
    const { data: siteRow } = await admin
      .from("sites")
      .select("tenant_id")
      .eq("id", siteId)
      .single();

    const tenantId = siteRow?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // 2. Ensure assessment exists
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

    // 4. If no content from browser (PDFs/images), download from GCS and base64-encode
    if (!content) {
      const { data: attachment } = await admin
        .from("attachments")
        .select("file_path, mime_type")
        .eq("id", attachmentId)
        .single();

      if (!attachment) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }

      try {
        const fileBuffer = await downloadFile(attachment.file_path);
        const bytes = new Uint8Array(fileBuffer);
        // Cap at 3MB raw to keep base64 under ~4MB (Claude's practical limit)
        const maxBytes = 3 * 1024 * 1024;
        const slice = bytes.length > maxBytes ? bytes.slice(0, maxBytes) : bytes;
        let binary = "";
        for (let i = 0; i < slice.length; i++) {
          binary += String.fromCharCode(slice[i]!);
        }
        content = btoa(binary);
        mimeType = attachment.mime_type ?? undefined;
      } catch (dlErr) {
        return NextResponse.json(
          { error: `File download failed: ${dlErr instanceof Error ? dlErr.message : String(dlErr)}` },
          { status: 500 },
        );
      }
    }

    // 5. Call Claude
    let extraction;
    try {
      extraction = await extractBaseline(content!, mimeType || "text/plain", fileName || "document", categoryInstructions);
    } catch (aiErr) {
      return NextResponse.json(
        { error: `AI extraction failed: ${aiErr instanceof Error ? aiErr.message : String(aiErr)}` },
        { status: 500 },
      );
    }

    // 5. Save extraction record
    const { data: extractionRecord, error: extErr } = await fromTable(admin, "document_extractions")
      .insert({
        attachment_id: attachmentId,
        site_id: siteId,
        tenant_id: tenantId,
        assessment_id: assessment.id,
        document_type: guessDocumentType(fileName || "", extraction.sectionsFound),
        status: "accepted",
        extracted_data: extraction,
        confidence: extraction.confidence,
        reviewed_by: session.claims.profileId,
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (extErr || !extractionRecord) {
      return NextResponse.json({ error: "Failed to save extraction record" }, { status: 500 });
    }

    // 6. Auto-apply to baseline tables
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
    }

    // 7. Save AI summary to attachment metadata
    const summary = extraction.summary || `Extracted: ${extraction.sectionsFound.join(", ")}`;
    const { data: currentAtt } = await admin
      .from("attachments")
      .select("metadata")
      .eq("id", attachmentId)
      .single();

    const existingMeta = (currentAtt?.metadata || {}) as Record<string, unknown>;
    await admin
      .from("attachments")
      .update({ metadata: { ...existingMeta, ai_summary: summary } })
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
