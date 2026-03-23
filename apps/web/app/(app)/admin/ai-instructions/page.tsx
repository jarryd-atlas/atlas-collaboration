import { requireSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { redirect } from "next/navigation";
import { AIInstructionsEditor } from "./_components/editor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  "interval-data":
    "This is interval demand data. For large files, the raw 15-min/hourly readings have been pre-aggregated into monthly summaries (sum, max, min, avg) computed from the complete dataset — these values are exact. Use the monthly _sum columns for total kWh, _max for peak demand kW, and _avg for average demand. Calculate load factor as avg/max. If column names suggest TOU periods (on-peak, off-peak, shoulder), extract those breakdowns. The _max value is the actual metered peak — note if it differs significantly from what a utility bill might show as billing demand.",
  "utility-bills":
    "This is an electric utility bill. Extract provider names, account/meter numbers, rate schedule name, all line item charges, total kWh consumption, peak demand kW, PLC/transmission tags, TOU period breakdowns, and sales tax. Map charges to supply vs distribution.",
  "round-sheets":
    "These are operator round sheets or system logs. Extract compressor suction/discharge pressures, condenser temperatures, evaporator temps, oil levels, and any anomalies noted. Map readings to specific equipment if identifiable.",
  "p-and-id":
    "This is a P&ID (piping and instrumentation diagram). Extract equipment names/tags, compressor details (HP, type, loop assignment), condenser fans, evaporator coils, vessel information, and piping connections between components.",
  "mass-balance":
    "This is a mass balance or refrigeration load worksheet. Extract compressor loading percentages by season, system capacity, total connected HP, loop assignments, and any calculated savings opportunities.",
  "electrical-drawings":
    "These are electrical drawings or single-line diagrams. Extract motor HP ratings, VFD presence, panel schedules, transformer sizes, and connected load information for refrigeration equipment.",
};

const CATEGORY_LABELS: Record<string, string> = {
  "interval-data": "Interval Data",
  "utility-bills": "Utility Bills",
  "round-sheets": "Round Sheets / System Logs",
  "p-and-id": "P&ID",
  "mass-balance": "Mass Balance Worksheet",
  "electrical-drawings": "Electrical Drawings",
};

export default async function AIInstructionsPage() {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    redirect("/");
  }

  const tenantId = claims.tenantId!;
  const admin = createSupabaseAdmin();

  // Fetch existing instructions
  const { data: existing } = await fromTable(admin, "ai_category_instructions")
    .select("*")
    .eq("tenant_id", tenantId);

  // Build merged list: defaults + any overrides
  const existingMap = new Map(
    ((existing as any[]) ?? []).map((row: any) => [row.category_key, row])
  );

  const categories = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const row = existingMap.get(key);
    return {
      key,
      label,
      instructions: (row?.instructions as string) ?? DEFAULT_INSTRUCTIONS[key] ?? "",
      isActive: row?.is_active ?? true,
      id: row?.id as string | null ?? null,
      isDefault: !row,
    };
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Analysis Instructions</h1>
        <p className="text-gray-500 mt-1">
          Customize the instructions Claude uses when analyzing documents in each category.
          These are prepended to the system prompt for category-specific context.
        </p>
      </div>

      <AIInstructionsEditor
        categories={categories}
        tenantId={tenantId}
        defaults={DEFAULT_INSTRUCTIONS}
      />
    </div>
  );
}
