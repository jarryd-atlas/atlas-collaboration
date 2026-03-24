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

  // Load any existing baseline data for context
  const existingData: Record<string, unknown> = {};

  const { data: opParams } = await fromTable(admin, "site_operational_params")
    .select("*")
    .eq("assessment_id", assessment?.id)
    .maybeSingle();
  if (opParams) existingData.operationalParams = opParams;

  const { data: equipment } = await fromTable(admin, "site_equipment")
    .select("category, name, manufacturer, model, specs")
    .eq("assessment_id", assessment?.id);
  if (equipment?.length) existingData.equipment = equipment;

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
      deepgramApiKey={process.env.DEEPGRAM_API_KEY ?? ""}
    />
  );
}
