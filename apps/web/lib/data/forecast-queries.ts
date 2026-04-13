/**
 * Data fetching and time-period logic for the Revenue Forecast tool.
 * Fetches all open deals from HubSpot and structures them for forecast display.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { getDeals, listAllDeals } from "../hubspot/client";
import { DEAL_STAGE_LABELS, CLOSED_STAGE_IDS, getDealType } from "../hubspot/constants";

// ─── Types ────────────────────────────────────────────────

export interface ForecastDeal {
  dealId: string;
  dealName: string;
  customerName: string;
  siteName: string | null;
  dealType: "new_business" | "renewal";
  stage: string;
  stageId: string;
  amount: number;
  arr: number;
  nrc: number;
  upgradeRevenue: number;
  forecastCategory: "commit" | "most_likely" | "best_case" | "pipeline" | "omit" | null;
  closeDate: string | null;
  ownerId: string | null;
}

export type TimePeriod = "this_quarter" | "next_quarter" | "this_year" | "twelve_month";

export interface TimePeriodConfig {
  key: TimePeriod;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

export interface ForecastBuckets {
  commit: { deals: ForecastDeal[]; total: number };
  bestCase: { deals: ForecastDeal[]; total: number };
  pipeline: { deals: ForecastDeal[]; total: number };
}

export interface ForecastData {
  deals: ForecastDeal[];
  periods: TimePeriodConfig[];
}

export interface ClosedDeal {
  dealId: string;
  stageId: string;
  amount: number;
  closeDate: string | null;
  createdAt: string | null;
  dealType: "new_business" | "renewal";
  isWon: boolean;
}

export interface ForecastTarget {
  periodKey: string;
  targetAmount: number;
}

// ─── Constants ────────────────────────────────────────────

const WON_STAGE_IDS = new Set([
  "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00", // New Biz Won
  "80a99505-8d78-4864-bee8-c416cb2e7f4f",  // Renewal Won
]);

const LOST_STAGE_IDS = new Set([
  "5b2cab04-4ab5-4249-8487-0b3834d444c5",  // New Biz Lost
  "dddab890-d5f2-4399-9886-f2ad9fb46864",  // Renewal Lost
]);

// ─── Time Period Logic ────────────────────────────────────

function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0, 23, 59, 59, 999),
  };
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth() + 1) / 3) };
}

function getNextQuarter(): { year: number; quarter: number } {
  const { year, quarter } = getCurrentQuarter();
  return quarter === 4 ? { year: year + 1, quarter: 1 } : { year, quarter: quarter + 1 };
}

function formatQuarterLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

export function getTimePeriods(): TimePeriodConfig[] {
  const now = new Date();
  const currentQ = getCurrentQuarter();
  const nextQ = getNextQuarter();
  const currentQRange = getQuarterRange(currentQ.year, currentQ.quarter);
  const nextQRange = getQuarterRange(nextQ.year, nextQ.quarter);

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const twelveMonthEnd = new Date(now);
  twelveMonthEnd.setFullYear(twelveMonthEnd.getFullYear() + 1);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startMonth = monthNames[now.getMonth()];
  const endMonth = monthNames[twelveMonthEnd.getMonth()];

  return [
    {
      key: "this_quarter",
      label: "This Quarter",
      sublabel: formatQuarterLabel(currentQ.year, currentQ.quarter),
      start: currentQRange.start,
      end: currentQRange.end,
    },
    {
      key: "next_quarter",
      label: "Next Quarter",
      sublabel: formatQuarterLabel(nextQ.year, nextQ.quarter),
      start: nextQRange.start,
      end: nextQRange.end,
    },
    {
      key: "this_year",
      label: "This Year",
      sublabel: `${now.getFullYear()}`,
      start: yearStart,
      end: yearEnd,
    },
    {
      key: "twelve_month",
      label: "12-Month",
      sublabel: `${startMonth} '${String(now.getFullYear()).slice(2)}–${endMonth} '${String(twelveMonthEnd.getFullYear()).slice(2)}`,
      start: now,
      end: twelveMonthEnd,
    },
  ];
}

// ─── Forecast Bucket Calculation ──────────────────────────

export function computeBuckets(deals: ForecastDeal[]): ForecastBuckets {
  const commitDeals = deals.filter((d) => d.forecastCategory === "commit");
  const mostLikelyDeals = deals.filter((d) => d.forecastCategory === "most_likely");
  const bestCaseDeals = deals.filter((d) => d.forecastCategory === "best_case");
  const pipelineDeals = deals.filter((d) => d.forecastCategory === "pipeline");
  // Uncategorized deals (null category) still belong in the pipeline total
  const uncategorizedDeals = deals.filter((d) => !d.forecastCategory);

  // Cumulative waterfall: Commit ⊂ Best Case ⊂ Pipeline
  const commitTotal = sum(commitDeals);
  const bestCaseTotal = commitTotal + sum(mostLikelyDeals) + sum(bestCaseDeals);
  const pipelineTotal = bestCaseTotal + sum(pipelineDeals) + sum(uncategorizedDeals);

  const allPipelineDeals = [...commitDeals, ...mostLikelyDeals, ...bestCaseDeals, ...pipelineDeals, ...uncategorizedDeals];

  return {
    commit: { deals: commitDeals, total: commitTotal },
    bestCase: { deals: [...commitDeals, ...mostLikelyDeals, ...bestCaseDeals], total: bestCaseTotal },
    pipeline: { deals: allPipelineDeals, total: pipelineTotal },
  };
}

function sum(deals: ForecastDeal[]): number {
  return deals.reduce((s, d) => s + d.amount, 0);
}

export function filterDealsByPeriod(deals: ForecastDeal[], period: TimePeriodConfig): ForecastDeal[] {
  return deals.filter((d) => {
    if (!d.closeDate) return false;
    const close = new Date(d.closeDate);
    return close >= period.start && close <= period.end;
  });
}

export function filterDealsByType(deals: ForecastDeal[], type: "all" | "new_business" | "renewal"): ForecastDeal[] {
  if (type === "all") return deals;
  return deals.filter((d) => d.dealType === type);
}

// ─── Data Fetching ────────────────────────────────────────

const FORECAST_PROPERTIES = [
  "dealname", "dealstage", "amount", "arc", "nrc",
  "upgrade_revenue", "hs_manual_forecast_category", "closedate",
  "pipeline", "hubspot_owner_id",
];

export async function getForecastDeals(): Promise<ForecastDeal[]> {
  const supabase = createSupabaseAdmin();

  // Get HubSpot config
  const { data: config } = await (supabase as any)
    .from("hubspot_config")
    .select("access_token, is_active")
    .limit(1)
    .single();

  if (!config?.is_active || !config?.access_token) return [];

  // Get all site links
  const { data: links } = await (supabase as any)
    .from("hubspot_site_links")
    .select("hubspot_deal_id, site_id, deal_name, deal_type");

  if (!links || links.length === 0) return [];

  // Get site → customer mapping
  const siteIds = [...new Set(links.map((l: any) => l.site_id))] as string[];
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, customer_id")
    .in("id", siteIds);

  const siteMap = new Map((sites ?? []).map((s: any) => [s.id, s]));

  // Get customer names
  const customerIds = [...new Set((sites ?? []).map((s: any) => s.customer_id).filter(Boolean))] as string[];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .in("id", customerIds);

  const customerMap = new Map((customers ?? []).map((c: any) => [c.id, c.name]));

  // Fetch deal properties from HubSpot
  const dealIds = [...new Set(links.map((l: any) => l.hubspot_deal_id))] as string[];
  if (dealIds.length === 0) return [];

  let deals: any[] = [];
  try {
    deals = await getDeals(config.access_token, dealIds, FORECAST_PROPERTIES);
  } catch {
    return [];
  }

  const dealMap = new Map(deals.map((d: any) => [d.id, d.properties]));

  // Build ForecastDeal array
  const result: ForecastDeal[] = [];
  const seenDealIds = new Set<string>();

  for (const link of links) {
    if (seenDealIds.has(link.hubspot_deal_id)) continue;
    seenDealIds.add(link.hubspot_deal_id);

    const site = siteMap.get(link.site_id);
    const props = dealMap.get(link.hubspot_deal_id);
    if (!props) continue;

    const stageId = props.dealstage ?? "";

    // Exclude closed deals
    if (CLOSED_STAGE_IDS.has(stageId)) continue;

    // Normalize forecast category to lowercase (HubSpot returns UPPER_CASE)
    const rawCategory = props.hs_manual_forecast_category ?? null;
    const category = rawCategory ? rawCategory.toLowerCase() : null;
    if (category === "omit") continue;

    const customerId = site?.customer_id;
    const customerName = customerId ? (customerMap.get(customerId) ?? "Unknown") : "Unknown";

    result.push({
      dealId: link.hubspot_deal_id,
      dealName: props.dealname ?? link.deal_name ?? "",
      customerName,
      siteName: site?.name ?? null,
      dealType: getDealType(stageId, props.pipeline),
      stage: DEAL_STAGE_LABELS[stageId] ?? stageId,
      stageId,
      amount: parseFloat(props.amount || "0"),
      arr: parseFloat(props.arc || "0"),
      nrc: parseFloat(props.nrc || "0"),
      upgradeRevenue: parseFloat(props.upgrade_revenue || "0"),
      forecastCategory: (category as ForecastDeal["forecastCategory"]) ?? null,
      closeDate: props.closedate ?? null,
      ownerId: props.hubspot_owner_id ?? null,
    });
  }

  return result;
}

// ─── Closed Deals (for CRO Metrics) ──────────────────────

export async function getClosedDealsForMetrics(): Promise<ClosedDeal[]> {
  const supabase = createSupabaseAdmin();

  const { data: config } = await (supabase as any)
    .from("hubspot_config")
    .select("access_token, is_active")
    .limit(1)
    .single();

  if (!config?.is_active || !config?.access_token) return [];

  let allDeals: any[] = [];
  try {
    allDeals = await listAllDeals(config.access_token, FORECAST_PROPERTIES);
  } catch {
    return [];
  }

  const result: ClosedDeal[] = [];

  for (const deal of allDeals) {
    const stageId = deal.properties?.dealstage ?? "";
    const isWon = WON_STAGE_IDS.has(stageId);
    const isLost = LOST_STAGE_IDS.has(stageId);
    if (!isWon && !isLost) continue;

    result.push({
      dealId: deal.id,
      stageId,
      amount: parseFloat(deal.properties?.amount || "0"),
      closeDate: deal.properties?.closedate ?? null,
      createdAt: deal.createdAt ?? null,
      dealType: getDealType(stageId, deal.properties?.pipeline),
      isWon,
    });
  }

  return result;
}

// ─── Forecast Targets ─────────────────────────────────────

export async function getForecastTargets(): Promise<Map<string, number>> {
  const supabase = createSupabaseAdmin();

  const { data } = await (supabase as any)
    .from("forecast_targets")
    .select("period_key, target_amount");

  const map = new Map<string, number>();
  if (data) {
    for (const row of data) {
      map.set(row.period_key, parseFloat(row.target_amount));
    }
  }
  return map;
}

/**
 * Convert a TimePeriodConfig to a period_key string for the forecast_targets table.
 * Returns null for twelve_month (rolling window has no fixed target).
 */
export function periodKeyFromConfig(period: TimePeriodConfig): string | null {
  const currentQ = getCurrentQuarter();
  const nextQ = getNextQuarter();

  switch (period.key) {
    case "this_quarter":
      return `${currentQ.year}-Q${currentQ.quarter}`;
    case "next_quarter":
      return `${nextQ.year}-Q${nextQ.quarter}`;
    case "this_year":
      return `${new Date().getFullYear()}`;
    case "twelve_month":
      return null; // Rolling window — no fixed target
    default:
      return null;
  }
}
