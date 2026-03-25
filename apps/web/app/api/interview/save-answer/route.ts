import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { functionName, args, siteId, assessmentId, tenantId, interviewId } = body;

    const admin = createSupabaseAdmin();

    // ── Create interview record ──────────────────
    if (functionName === "_create_interview") {
      const { data } = await fromTable(admin, "site_interviews")
        .insert({
          site_id: siteId,
          tenant_id: tenantId,
          assessment_id: assessmentId || null,
          started_by: session.claims.profileId ?? null,
          status: "in_progress",
        })
        .select("id")
        .single();
      return NextResponse.json({ success: true, interviewId: data?.id });
    }

    // ── Save transcript (auto-save, no status change) ──
    if (functionName === "_save_transcript") {
      if (interviewId) {
        await fromTable(admin, "site_interviews")
          .update({
            transcript: args.transcript ?? [],
            fields_collected: args.fieldsCollected ?? {},
            duration_sec: args.durationSec ?? 0,
          })
          .eq("id", interviewId);
      }
      return NextResponse.json({ success: true });
    }

    // ── End interview ────────────────────────────
    if (functionName === "_end_interview") {
      if (interviewId) {
        await fromTable(admin, "site_interviews")
          .update({
            status: "completed",
            transcript: args.transcript ?? [],
            fields_collected: args.fieldsCollected ?? {},
            duration_sec: args.durationSec ?? 0,
          })
          .eq("id", interviewId);

        // Auto-trigger analysis (fire-and-forget)
        if (assessmentId && siteId && tenantId) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

          fetch(`${baseUrl}/api/interview/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: request.headers.get("cookie") ?? "",
            },
            body: JSON.stringify({ interviewId, siteId, assessmentId, tenantId }),
          }).catch((err) => {
            console.error("Auto-trigger analysis failed (non-critical):", err);
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown function: ${functionName}` }, { status: 400 });
  } catch (err) {
    console.error("Interview save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 },
    );
  }
}
