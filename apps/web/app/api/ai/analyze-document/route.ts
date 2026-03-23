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
      let totalDataRows = 0;
      let isLargeTimeSeries = false;

      // Check sheet sizes using range (no materialization)
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet["!ref"]) continue;
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        const rowCount = range.e.r - range.s.r + 1;
        totalDataRows += rowCount;
        if (rowCount > 1000) isLargeTimeSeries = true;
      }

      if (isLargeTimeSeries) {
        // Pre-aggregate large time-series data instead of sending raw rows
        // This gives Claude accurate monthly summaries computed from ALL rows
        csvParts.push(`[PRE-AGGREGATED DATA: Computed from ${totalDataRows.toLocaleString()} rows of interval/demand data in the original file. All values are exact calculations from the complete dataset.]`);

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
          if (rows.length < 2) continue;

          const headerRow = rows[0] as string[];
          csvParts.push(`\n=== Sheet: ${sheetName} (${rows.length - 1} data rows) ===`);
          csvParts.push(`Column headers: ${headerRow.join(", ")}`);

          // Show first 5 raw rows so Claude understands the format
          csvParts.push(`\nSample rows (first 5):`);
          for (let i = 1; i <= Math.min(5, rows.length - 1); i++) {
            csvParts.push((rows[i] as unknown[]).join(","));
          }

          // Find numeric columns and date/time column
          const numCols: { idx: number; name: string }[] = [];
          let dateColIdx = -1;
          for (let c = 0; c < headerRow.length; c++) {
            const name = String(headerRow[c] ?? "").toLowerCase();
            if (name.includes("date") || name.includes("time") || name.includes("timestamp") || c === 0) {
              if (dateColIdx === -1) dateColIdx = c;
            }
            // Check if column has numeric data
            const sampleVal = rows[1]?.[c];
            if (typeof sampleVal === "number" || (typeof sampleVal === "string" && !isNaN(Number(sampleVal)) && sampleVal.trim() !== "")) {
              numCols.push({ idx: c, name: String(headerRow[c] ?? `col_${c}`) });
            }
          }

          // Aggregate by month
          const monthlyData = new Map<string, { count: number; sums: number[]; maxes: number[]; mins: number[] }>();

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r] as unknown[];
            let monthKey = "unknown";

            // Try to parse date from the date column
            if (dateColIdx >= 0 && row[dateColIdx] != null) {
              const raw = row[dateColIdx];
              let d: Date | null = null;
              if (typeof raw === "number") {
                // Excel serial date
                d = new Date((raw - 25569) * 86400 * 1000);
              } else if (typeof raw === "string" && raw.trim()) {
                d = new Date(raw);
              }
              if (d && !isNaN(d.getTime())) {
                monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
              }
            }

            if (!monthlyData.has(monthKey)) {
              monthlyData.set(monthKey, {
                count: 0,
                sums: numCols.map(() => 0),
                maxes: numCols.map(() => -Infinity),
                mins: numCols.map(() => Infinity),
              });
            }
            const bucket = monthlyData.get(monthKey)!;
            bucket.count++;

            for (let nc = 0; nc < numCols.length; nc++) {
              const val = Number(row[numCols[nc]!.idx]);
              if (!isNaN(val)) {
                bucket.sums[nc]! += val;
                if (val > bucket.maxes[nc]!) bucket.maxes[nc] = val;
                if (val < bucket.mins[nc]!) bucket.mins[nc] = val;
              }
            }
          }

          // Format monthly aggregates as a table Claude can parse
          if (monthlyData.size > 0 && numCols.length > 0) {
            csvParts.push(`\nMonthly aggregated summary (computed from all ${rows.length - 1} rows):`);
            const colNames = numCols.map((c) => c.name);
            csvParts.push(`Month,Readings,${colNames.map((n) => `${n}_sum,${n}_max,${n}_min,${n}_avg`).join(",")}`);

            const sortedMonths = [...monthlyData.entries()].sort((a, b) => a[0].localeCompare(b[0]));
            for (const [month, data] of sortedMonths) {
              const vals = numCols.map((_, nc) => {
                const sum = data.sums[nc] ?? 0;
                const max = data.maxes[nc] === -Infinity ? 0 : (data.maxes[nc] ?? 0);
                const min = data.mins[nc] === Infinity ? 0 : (data.mins[nc] ?? 0);
                const avg = data.count > 0 ? sum / data.count : 0;
                return `${sum.toFixed(2)},${max.toFixed(2)},${min.toFixed(2)},${avg.toFixed(2)}`;
              });
              csvParts.push(`${month},${data.count},${vals.join(",")}`);
            }
          }
        }
      } else {
        // Small spreadsheet — send full content
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          csvParts.push(`=== Sheet: ${sheetName} ===`);
          csvParts.push(XLSX.utils.sheet_to_csv(sheet));
        }
      }

      content = csvParts.join("\n");

      // Final safety check — if still too large, hard truncate
      const MAX_CHARS = 400_000;
      if (content.length > MAX_CHARS) {
        content = content.substring(0, MAX_CHARS) + "\n\n[Content truncated at 400K characters]";
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
