import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const { step } = await req.json();

  try {
    if (step === "env") {
      return NextResponse.json({
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasGcsBucket: !!process.env.GCS_BUCKET,
        hasGcsJson: !!process.env.GCS_SERVICE_ACCOUNT_JSON,
        hasSupabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
    }

    if (step === "attachment") {
      const admin = createSupabaseAdmin();
      const { data, error } = await admin
        .from("attachments")
        .select("id, file_name, file_path, mime_type")
        .eq("id", "b0cbc3e9-fea0-4a5f-898a-afc1b2d56ace")
        .single();
      return NextResponse.json({ data, error });
    }

    if (step === "gcs") {
      const { downloadFile } = await import("../../../lib/storage/gcs");
      const buf = await downloadFile("sites/1305e2f1-1832-4f73-a597-a310af98a50c/interval-data/AMC Vernon CA - 2025 kW Interval Data.xlsx");
      return NextResponse.json({ size: buf.byteLength });
    }

    if (step === "xlsx") {
      const { downloadFile } = await import("../../../lib/storage/gcs");
      const buf = await downloadFile("sites/1305e2f1-1832-4f73-a597-a310af98a50c/interval-data/AMC Vernon CA - 2025 kW Interval Data.xlsx");
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      return NextResponse.json({ sheets: wb.SheetNames, rows: XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]!]!).split("\n").length });
    }

    if (step === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
          messages: [{ role: "user", content: "Say hello in 5 words" }],
        }),
      });
      const body = await res.text();
      return NextResponse.json({ status: res.status, body: body.substring(0, 500) });
    }

    if (step === "migrate016") {
      const admin = createSupabaseAdmin();
      // Step 1: Delete empty duplicate
      await (admin as any).from("site_assessments").delete().eq("site_id", "36c0aee2-2c6e-4a70-96da-3bcd2ed3e268");
      await (admin as any).from("sites").delete().eq("id", "36c0aee2-2c6e-4a70-96da-3bcd2ed3e268");
      // Steps 2-4 (NOT NULL + unique index) need raw SQL — use rpc
      const { error: rpcErr } = await admin.rpc("exec_sql" as any, {
        query: `UPDATE sites SET address = name WHERE address IS NULL; ALTER TABLE sites ALTER COLUMN address SET NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS sites_address_unique ON sites (LOWER(address));`
      });
      // If rpc doesn't exist, the delete at least worked
      return NextResponse.json({ success: true, rpcError: rpcErr?.message ?? null });
    }

    return NextResponse.json({ error: "unknown step" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack?.split("\n").slice(0,3) : null });
  }
}
