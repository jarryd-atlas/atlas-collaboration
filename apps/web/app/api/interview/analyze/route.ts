import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { analyzeInterviewTranscript } from "@repo/ai";
import type { BaselineExtraction } from "@repo/ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId, siteId, assessmentId, tenantId } = await request.json();

    if (!interviewId || !siteId || !assessmentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // Load the transcript
    const { data: interview, error: fetchError } = await fromTable(admin, "site_interviews")
      .select("transcript, analysis_status")
      .eq("id", interviewId)
      .single();

    if (fetchError || !interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (interview.analysis_status === "processing") {
      return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
    }

    const transcript = interview.transcript as { role: string; text: string; timestamp: number }[];
    if (!transcript || transcript.length === 0) {
      return NextResponse.json({ error: "No transcript to analyze" }, { status: 400 });
    }

    // Mark as processing
    await fromTable(admin, "site_interviews")
      .update({ analysis_status: "processing" })
      .eq("id", interviewId);

    try {
      // Run the analysis
      const result = await analyzeInterviewTranscript(
        transcript.map((t) => ({
          role: t.role as "agent" | "user",
          text: t.text,
          timestamp: t.timestamp,
        })),
      );

      // Save extracted data to baseline tables
      await saveExtractedData(admin, result, siteId, assessmentId, tenantId);

      // Mark as completed
      await fromTable(admin, "site_interviews")
        .update({
          analysis_status: "completed",
          analysis_summary: result.summary,
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", interviewId);

      return NextResponse.json({
        success: true,
        summary: result.summary,
        sectionsFound: result.sectionsFound,
        confidence: result.confidence,
      });
    } catch (analysisError) {
      // Mark as failed
      await fromTable(admin, "site_interviews")
        .update({
          analysis_status: "failed",
          analysis_error: analysisError instanceof Error ? analysisError.message : "Analysis failed",
        })
        .eq("id", interviewId);

      throw analysisError;
    }
  } catch (err) {
    console.error("Interview analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}

/**
 * Save extracted baseline data to the appropriate database tables.
 * Mirrors the save logic from the old real-time function call handlers.
 */
async function saveExtractedData(
  admin: ReturnType<typeof createSupabaseAdmin>,
  data: BaselineExtraction,
  siteId: string,
  assessmentId: string,
  tenantId: string,
) {
  // ── Contacts ────────────────────────────────────
  if (data.siteContacts && data.siteContacts.length > 0) {
    for (const contact of data.siteContacts) {
      await fromTable(admin, "site_contacts")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          name: contact.name,
          title: contact.title ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null,
          is_primary: false,
        });
    }
  }

  // ── Equipment ───────────────────────────────────
  if (data.equipment && data.equipment.length > 0) {
    for (const equip of data.equipment) {
      await fromTable(admin, "site_equipment")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          category: equip.category,
          name: equip.name ?? `${equip.category}-${Date.now()}`,
          manufacturer: equip.manufacturer ?? null,
          model: equip.model ?? null,
          quantity: equip.quantity ?? 1,
          specs: equip.specs ?? {},
        });
    }
  }

  // ── Operational Params ──────────────────────────
  if (data.operationalParams) {
    const params = data.operationalParams;
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        // Convert camelCase to snake_case for DB
        const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        updateData[snakeKey] = value;
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { data: existing } = await fromTable(admin, "site_operational_params")
        .select("id").eq("assessment_id", assessmentId).maybeSingle();

      if (existing) {
        await fromTable(admin, "site_operational_params")
          .update(updateData).eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_operational_params")
          .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...updateData });
      }
    }
  }

  // ── Operations Detail ───────────────────────────
  if (data.operations) {
    const ops = data.operations;
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ops)) {
      if (value !== undefined && value !== null) {
        const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        updateData[snakeKey] = value;
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { data: existing } = await fromTable(admin, "site_operational_params")
        .select("id").eq("assessment_id", assessmentId).maybeSingle();

      if (existing) {
        await fromTable(admin, "site_operational_params")
          .update(updateData).eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_operational_params")
          .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...updateData });
      }
    }
  }

  // ── TOU Schedule ────────────────────────────────
  if (data.touSchedule) {
    const tou = data.touSchedule;
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(tou)) {
      if (value !== undefined && value !== null) {
        const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        updateData[snakeKey] = value;
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { data: existing } = await fromTable(admin, "site_tou_schedule")
        .select("id").eq("assessment_id", assessmentId).maybeSingle();

      if (existing) {
        await fromTable(admin, "site_tou_schedule")
          .update(updateData).eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_tou_schedule")
          .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...updateData });
      }
    }
  }

  // ── Labor ───────────────────────────────────────
  if (data.labor) {
    const labor = data.labor;
    const insertData: Record<string, unknown> = {
      assessment_id: assessmentId,
      site_id: siteId,
      tenant_id: tenantId,
    };

    if (labor.headcount) insertData.headcount = labor.headcount;
    if (labor.painPoints) insertData.pain_points = labor.painPoints;
    if (labor.manualProcesses) insertData.manual_processes = labor.manualProcesses;
    if (labor.timeSinks) insertData.time_sinks = labor.timeSinks;
    if (labor.automationOpportunities) insertData.automation_opportunities = labor.automationOpportunities;

    const { data: existing } = await fromTable(admin, "site_labor_baseline")
      .select("id").eq("assessment_id", assessmentId).maybeSingle();

    if (existing) {
      const { assessment_id, site_id, tenant_id, ...updateFields } = insertData;
      await fromTable(admin, "site_labor_baseline")
        .update(updateFields).eq("assessment_id", assessmentId);
    } else {
      await fromTable(admin, "site_labor_baseline").insert(insertData);
    }
  }

  // ── Energy / Savings ────────────────────────────
  if (data.energyData && data.energyData.length > 0) {
    // Save the first energy data entry's aggregate info to savings analysis
    const first = data.energyData[0]!;
    const savingsData: Record<string, unknown> = {};
    if (first.totalCharges) savingsData.annual_energy_spend = first.totalCharges;
    if (first.totalKwh) savingsData.pre_atlas_kwh = first.totalKwh * 12;
    if (first.peakDemandKw) savingsData.peak_demand_kw = first.peakDemandKw;

    if (Object.keys(savingsData).length > 0) {
      const { data: existing } = await fromTable(admin, "site_savings_analysis")
        .select("id").eq("assessment_id", assessmentId).maybeSingle();

      if (existing) {
        await fromTable(admin, "site_savings_analysis")
          .update(savingsData).eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_savings_analysis")
          .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...savingsData });
      }
    }
  }
}
