import { requireSession } from "../../../../../../../lib/supabase/server";
import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "../../../../../../../lib/supabase/server";
import { InterviewSession } from "./_components/interview-session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

interface PageProps {
  params: Promise<{ customerSlug: string; siteSlug: string }>;
}

export default async function InterviewPage({ params }: PageProps) {
  const { customerSlug, siteSlug } = await params;
  const { claims } = await requireSession();

  if (claims.tenantType !== "internal") redirect("/");

  const admin = createSupabaseAdmin();

  // Load customer + site
  const { data: customer } = await admin
    .from("customers")
    .select("id, name, slug")
    .eq("slug", customerSlug)
    .single();

  if (!customer) redirect("/customers");

  const { data: site } = await admin
    .from("sites")
    .select("id, name, slug, tenant_id, pipeline_stage")
    .eq("slug", siteSlug)
    .eq("customer_id", customer.id)
    .single();

  if (!site) redirect(`/customers/${customerSlug}`);

  // Ensure assessment exists
  let { data: assessment } = await fromTable(admin, "site_assessments")
    .select("id")
    .eq("site_id", site.id)
    .single();

  if (!assessment) {
    const { data: newAssessment } = await fromTable(admin, "site_assessments")
      .insert({ site_id: site.id, tenant_id: site.tenant_id, status: "in_progress" })
      .select("id")
      .single();
    assessment = newAssessment;
  }

  // Load existing baseline data for agent context
  const existingData: Record<string, unknown> = {};
  const aid = assessment?.id;
  let resumeSection: string | undefined;
  let previousInterviews: { id: string; analysis_summary: string | null; duration_sec: number; created_at: string }[] = [];

  if (aid) {
    try {
      const [
        { data: contacts },
        { data: opParams },
        { data: equipment },
        { data: touSchedule },
        { data: savings },
        { data: labor },
        { data: energyData },
        { data: lastInterview },
        { data: prevInterviews },
      ] = await Promise.all([
        fromTable(admin, "site_contacts").select("name, title, email, phone, is_primary").eq("assessment_id", aid),
        fromTable(admin, "site_operational_params").select("*").eq("assessment_id", aid).maybeSingle(),
        fromTable(admin, "site_equipment").select("category, name, manufacturer, model, specs").eq("assessment_id", aid),
        fromTable(admin, "site_tou_schedule").select("supply_provider, distribution_provider, rate_name, account_number, demand_response_status").eq("assessment_id", aid).maybeSingle(),
        fromTable(admin, "site_savings_analysis").select("annual_energy_spend, pre_atlas_kwh, peak_demand_kw, refrigeration_pct, compressor_load_pct").eq("assessment_id", aid).maybeSingle(),
        fromTable(admin, "site_labor_baseline").select("headcount, pain_points, manual_processes, time_sinks, automation_opportunities").eq("assessment_id", aid).maybeSingle(),
        fromTable(admin, "site_energy_data").select("id").eq("assessment_id", aid).limit(1),
        fromTable(admin, "site_interviews").select("section_reached").eq("site_id", site.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        // Load previous completed interviews with analysis summaries
        fromTable(admin, "site_interviews")
          .select("id, analysis_summary, duration_sec, created_at")
          .eq("site_id", site.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (contacts?.length) existingData.contacts = contacts;
      if (opParams) existingData.operationalParams = opParams;
      if (equipment?.length) existingData.equipment = equipment;
      if (touSchedule) existingData.touSchedule = touSchedule;
      if (savings) existingData.savings = savings;
      if (labor) existingData.labor = labor;
      if (energyData?.length) existingData.hasEnergyData = true;
      if (lastInterview?.section_reached && lastInterview.section_reached !== "welcome") {
        resumeSection = lastInterview.section_reached;
      }
      if (prevInterviews?.length) {
        previousInterviews = prevInterviews;
      }
    } catch {
      // Non-critical — agent starts with less context if baseline load fails
    }
  }

  return (
    <InterviewSession
      siteId={site.id}
      siteName={site.name}
      siteSlug={siteSlug}
      customerName={customer.name}
      customerSlug={customerSlug}
      tenantId={site.tenant_id}
      assessmentId={assessment?.id ?? ""}
      existingData={Object.keys(existingData).length > 0 ? existingData : undefined}
      resumeSection={resumeSection}
      deepgramApiKey={process.env.DEEPGRAM_API_KEY ?? ""}
      anthropicApiKey={process.env.ANTHROPIC_API_KEY ?? ""}
      previousInterviews={previousInterviews.length > 0 ? previousInterviews : undefined}
    />
  );
}
