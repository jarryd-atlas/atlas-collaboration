import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import type { CollectedField } from "../../../../lib/interview/interview-types";

export const runtime = "edge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { functionName, args, siteId, assessmentId, tenantId, interviewId } = body;

  const admin = createSupabaseAdmin();

  try {
    // ── Special: create interview record ─────────────
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

    // ── Special: end interview ───────────────────────
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
      }
      return NextResponse.json({ success: true });
    }

    // ── advance_section ──────────────────────────────
    if (functionName === "advance_section") {
      if (interviewId) {
        await fromTable(admin, "site_interviews")
          .update({ section_reached: args.next_section })
          .eq("id", interviewId);
      }
      return NextResponse.json({ success: true, section: args.next_section });
    }

    // ── save_site_contact ────────────────────────────
    if (functionName === "save_site_contact") {
      const { data } = await fromTable(admin, "site_contacts")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          name: args.name,
          title: args.title ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          is_primary: args.is_primary ?? false,
        })
        .select("id")
        .single();

      const fieldsSaved: CollectedField[] = [
        { section: "contacts", label: args.title ? `${args.name} (${args.title})` : args.name, value: args.name },
      ];
      return NextResponse.json({ success: true, id: data?.id, fieldsSaved });
    }

    // ── save_equipment ───────────────────────────────
    if (functionName === "save_equipment") {
      const specs: Record<string, unknown> = {};
      if (args.hp) specs.hp = args.hp;
      if (args.type) specs.type = args.type;
      if (args.loop) specs.loop = args.loop;
      if (args.suction_setpoint_psig) specs.suction_setpoint_psig = args.suction_setpoint_psig;
      if (args.discharge_setpoint_psig) specs.discharge_setpoint_psig = args.discharge_setpoint_psig;
      if (args.loading_summer) specs.loading_summer = args.loading_summer;
      if (args.loading_shoulder) specs.loading_shoulder = args.loading_shoulder;
      if (args.loading_winter) specs.loading_winter = args.loading_winter;
      if (args.defrost_type) specs.defrost_type = args.defrost_type;
      if (args.num_units) specs.num_units = args.num_units;
      if (args.notes) specs.notes = args.notes;

      const { data } = await fromTable(admin, "site_equipment")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          category: args.category,
          name: args.name ?? `${args.category}-${Date.now()}`,
          manufacturer: args.manufacturer ?? null,
          model: args.model ?? null,
          quantity: args.quantity ?? 1,
          specs,
        })
        .select("id")
        .single();

      const label = `${args.manufacturer ?? ""} ${args.type ?? args.category} ${args.hp ? args.hp + "HP" : ""}`.trim();
      const fieldsSaved: CollectedField[] = [
        { section: "equipment", label: args.name ?? args.category, value: label },
      ];
      return NextResponse.json({ success: true, id: data?.id, fieldsSaved });
    }

    // ── save_operational_params ───────────────────────
    if (functionName === "save_operational_params") {
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) updateData[key] = value;
      }

      const { data: existing } = await fromTable(admin, "site_operational_params")
        .select("id")
        .eq("assessment_id", assessmentId)
        .maybeSingle();

      if (existing) {
        await fromTable(admin, "site_operational_params")
          .update(updateData)
          .eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_operational_params")
          .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...updateData });
      }

      const fieldsSaved: CollectedField[] = Object.entries(args)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ({ section: "operational_params", label: k.replace(/_/g, " "), value: String(v) }));

      return NextResponse.json({ success: true, fieldsSaved });
    }

    // ── save_energy_info ─────────────────────────────
    if (functionName === "save_energy_info") {
      // Split between site_tou_schedule and site_savings_analysis
      const touFields: Record<string, unknown> = {};
      const savingsFields: Record<string, unknown> = {};

      if (args.supply_provider) touFields.supply_provider = args.supply_provider;
      if (args.distribution_provider) touFields.distribution_provider = args.distribution_provider;
      if (args.rate_name) touFields.rate_name = args.rate_name;
      if (args.account_number) touFields.account_number = args.account_number;
      if (args.demand_response_status) touFields.demand_response_status = args.demand_response_status;

      if (args.annual_energy_spend) savingsFields.annual_energy_spend = args.annual_energy_spend;
      if (args.approximate_monthly_kwh) savingsFields.pre_atlas_kwh = args.approximate_monthly_kwh * 12;
      if (args.peak_demand_kw) savingsFields.peak_demand_kw = args.peak_demand_kw;

      // Upsert TOU schedule
      if (Object.keys(touFields).length > 0) {
        const { data: existingTou } = await fromTable(admin, "site_tou_schedule")
          .select("id").eq("assessment_id", assessmentId).maybeSingle();
        if (existingTou) {
          await fromTable(admin, "site_tou_schedule").update(touFields).eq("assessment_id", assessmentId);
        } else {
          await fromTable(admin, "site_tou_schedule").insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...touFields });
        }
      }

      // Upsert savings analysis
      if (Object.keys(savingsFields).length > 0) {
        const { data: existingSav } = await fromTable(admin, "site_savings_analysis")
          .select("id").eq("assessment_id", assessmentId).maybeSingle();
        if (existingSav) {
          await fromTable(admin, "site_savings_analysis").update(savingsFields).eq("assessment_id", assessmentId);
        } else {
          await fromTable(admin, "site_savings_analysis").insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...savingsFields });
        }
      }

      const fieldsSaved: CollectedField[] = Object.entries(args)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ({ section: "energy_info", label: k.replace(/_/g, " "), value: String(v) }));

      return NextResponse.json({ success: true, fieldsSaved });
    }

    // ── save_operations_detail ────────────────────────
    if (functionName === "save_operations_detail") {
      const { data: existing } = await fromTable(admin, "site_operations")
        .select("id").eq("assessment_id", assessmentId).maybeSingle();

      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) updateData[key] = value;
      }

      if (existing) {
        await fromTable(admin, "site_operations").update(updateData).eq("assessment_id", assessmentId);
      } else {
        await fromTable(admin, "site_operations").insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...updateData });
      }

      const fieldsSaved: CollectedField[] = Object.entries(args)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ({ section: "operations_detail", label: k.replace(/_/g, " "), value: String(v) }));

      return NextResponse.json({ success: true, fieldsSaved });
    }

    // ── save_labor_info ──────────────────────────────
    if (functionName === "save_labor_info") {
      // Upsert labor baseline with headcount + qualitative notes
      const { data: existing } = await fromTable(admin, "site_labor_baseline")
        .select("id, headcount, qualitative_assessment").eq("assessment_id", assessmentId).maybeSingle();

      if (existing) {
        const currentHeadcount = (existing.headcount as unknown[]) ?? [];
        const newEntry = {
          role: args.role ?? "general",
          count: args.count ?? 1,
          hoursPerWeek: args.hours_per_week ?? 40,
          hourlyRate: args.hourly_rate ?? null,
        };
        const updatedHeadcount = [...currentHeadcount, newEntry];
        const notes = [
          existing.qualitative_assessment ?? "",
          args.pain_points ? `Pain points: ${args.pain_points}` : "",
          args.manual_processes ? `Manual processes: ${args.manual_processes}` : "",
          args.time_sinks ? `Time sinks: ${args.time_sinks}` : "",
          args.automation_opportunities ? `Automation: ${args.automation_opportunities}` : "",
        ].filter(Boolean).join("\n");

        await fromTable(admin, "site_labor_baseline")
          .update({ headcount: updatedHeadcount, qualitative_assessment: notes || null })
          .eq("assessment_id", assessmentId);
      } else {
        const headcount = [{
          role: args.role ?? "general",
          count: args.count ?? 1,
          hoursPerWeek: args.hours_per_week ?? 40,
          hourlyRate: args.hourly_rate ?? null,
        }];
        const notes = [
          args.pain_points ? `Pain points: ${args.pain_points}` : "",
          args.manual_processes ? `Manual processes: ${args.manual_processes}` : "",
        ].filter(Boolean).join("\n");

        await fromTable(admin, "site_labor_baseline").insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          headcount,
          qualitative_assessment: notes || null,
        });
      }

      const label = args.role ? `${args.count ?? 1}x ${args.role}` : "Labor info";
      const fieldsSaved: CollectedField[] = [
        { section: "labor_info", label, value: args.role ?? "noted" },
      ];
      return NextResponse.json({ success: true, fieldsSaved });
    }

    return NextResponse.json({ error: `Unknown function: ${functionName}` }, { status: 400 });
  } catch (err) {
    console.error("Interview save error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 500 }
    );
  }
}
