/**
 * Monthly deal funnel snapshot job.
 *
 * Pulls every deal in the New Business pipeline from HubSpot (with stage
 * entry/exit history fields) and upserts month-end counts + total amount
 * per stage into `deal_funnel_snapshots`.
 *
 * Modes:
 *  - "backfill"      → compute every month from the earliest deal through now
 *  - "current_month" → compute only the current month (used by pg_cron on the 1st)
 *
 * Note: `amount` is the current deal amount; HubSpot does not expose
 * historical amounts without Enterprise add-ons. Documented in the UI.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Stage order (duplicated from apps/web/lib/hubspot/constants.ts) ───
// Worker is a standalone Node process and cannot import from the Next.js app.

const NEW_BUSINESS_PIPELINE_ID = "f95a95c9-99c3-4b7f-a250-1303e9288649";

const NEW_BUSINESS_STAGE_ORDER: { id: string; order: number; label: string }[] = [
  { id: "1188492915", order: 1,  label: "Intro/Contact" },
  { id: "250564613",  order: 2,  label: "Discovery" },
  { id: "1188492916", order: 3,  label: "Demonstration" },
  { id: "250564614",  order: 4,  label: "Data Collection" },
  { id: "1240422453", order: 5,  label: "Qualified" },
  { id: "1188492917", order: 6,  label: "Energy Value Assessment" },
  { id: "1188492918", order: 7,  label: "Executive Presentation" },
  { id: "1188492919", order: 8,  label: "M&V Alignment" },
  { id: "6b3b22f8-8bf4-40af-91e0-61bd1b0bfc63", order: 9,  label: "In Consideration" },
  { id: "250564615",  order: 10, label: "Out for Signature" },
  { id: "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00", order: 11, label: "Won" },
  { id: "10d2d0d7-556b-4fb9-aa24-12b0fd0159a6", order: 12, label: "Stalled" },
  { id: "5b2cab04-4ab5-4249-8487-0b3834d444c5", order: 13, label: "Lost" },
];

// ─── Types ─────────────────────────────────────────────────

interface SnapshotPayload {
  tenant_id: string;
  pipeline_id: string;
  mode: "backfill" | "current_month";
}

interface HubSpotDeal {
  id: string;
  properties: Record<string, string | null>;
}

// ─── HubSpot fetch (minimal) ────────────────────────────────

const HS_BASE = "https://api.hubapi.com";

async function listAllDeals(
  token: string,
  properties: string[],
): Promise<HubSpotDeal[]> {
  const all: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("limit", "100");
    properties.forEach((p) => params.append("properties", p));
    if (after) params.set("after", after);

    const res = await fetch(`${HS_BASE}/crm/v3/objects/deals?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as {
      results: HubSpotDeal[];
      paging?: { next?: { after: string } };
    };

    all.push(...(json.results ?? []));
    after = json.paging?.next?.after;
  } while (after);

  return all;
}

// ─── Date helpers ──────────────────────────────────────────

function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function lastMsOfMonthUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1;
}
function addMonthUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function toMonthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
function parseTs(v: string | null | undefined): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}
function parseNum(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── Job handler ───────────────────────────────────────────

export async function processDealFunnelSnapshot(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<void> {
  const { tenant_id, pipeline_id, mode } = payload as unknown as SnapshotPayload;

  if (!tenant_id || !pipeline_id || !mode) {
    throw new Error(
      "snapshot_deal_funnel: missing tenant_id, pipeline_id, or mode in payload",
    );
  }

  if (pipeline_id !== NEW_BUSINESS_PIPELINE_ID) {
    throw new Error(
      `snapshot_deal_funnel: only New Business pipeline supported (got ${pipeline_id})`,
    );
  }

  console.log(
    `[FunnelSnapshot] tenant=${tenant_id} mode=${mode} pipeline=${pipeline_id}`,
  );

  // 1. Fetch the tenant's HubSpot token.
  const { data: config, error: configErr } = await supabase
    .from("hubspot_config")
    .select("access_token")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .single();

  if (configErr || !config) {
    throw new Error(
      `HubSpot not connected for tenant ${tenant_id}: ${configErr?.message ?? "no config"}`,
    );
  }
  const token = (config as { access_token: string }).access_token;

  // 2. Pull every deal with stage history fields.
  const stageIds = NEW_BUSINESS_STAGE_ORDER.map((s) => s.id);
  const properties = [
    "dealname",
    "dealstage",
    "amount",
    "pipeline",
    "createdate",
    "closedate",
    ...stageIds.map((id) => `hs_date_entered_${id}`),
    ...stageIds.map((id) => `hs_date_exited_${id}`),
  ];

  const allDeals = await listAllDeals(token, properties);
  const deals = allDeals.filter((d) => d.properties?.pipeline === pipeline_id);

  console.log(
    `[FunnelSnapshot] fetched ${allDeals.length} deals total, ${deals.length} in New Business`,
  );

  if (deals.length === 0) {
    console.log("[FunnelSnapshot] no deals to snapshot — done");
    return;
  }

  // 3. Determine month range.
  const now = new Date();
  let from: Date;
  let to: Date;

  if (mode === "current_month") {
    from = firstOfMonthUTC(now);
    to = firstOfMonthUTC(now);
  } else {
    // backfill: earliest createdate → current month
    let earliest: number | null = null;
    for (const d of deals) {
      const t = parseTs(d.properties.createdate);
      if (t !== null && (earliest === null || t < earliest)) earliest = t;
    }
    from = earliest !== null ? firstOfMonthUTC(new Date(earliest)) : firstOfMonthUTC(now);
    to = firstOfMonthUTC(now);
  }

  // 4. Pre-parse stage history per deal.
  interface Prepared {
    amount: number;
    stages: Map<string, { entered: number | null; exited: number | null }>;
  }
  const prepared: Prepared[] = deals.map((d) => {
    const stages = new Map<string, { entered: number | null; exited: number | null }>();
    for (const sid of stageIds) {
      stages.set(sid, {
        entered: parseTs(d.properties[`hs_date_entered_${sid}`]),
        exited: parseTs(d.properties[`hs_date_exited_${sid}`]),
      });
    }
    return { amount: parseNum(d.properties.amount), stages };
  });

  // 5. Walk months → stages → deals.
  const rows: {
    tenant_id: string;
    pipeline_id: string;
    snapshot_month: string;
    stage_id: string;
    stage_label: string;
    stage_order: number;
    deal_count: number;
    total_amount: number;
    computed_at: string;
  }[] = [];

  const computedAt = new Date().toISOString();
  let cursor = from;
  while (cursor.getTime() <= to.getTime()) {
    const monthKey = toMonthKey(cursor);
    const monthEndMs = lastMsOfMonthUTC(cursor);

    for (const { id: stageId, order, label } of NEW_BUSINESS_STAGE_ORDER) {
      let count = 0;
      let total = 0;
      for (const deal of prepared) {
        const s = deal.stages.get(stageId);
        if (!s || s.entered === null) continue;
        if (s.entered > monthEndMs) continue;
        if (s.exited !== null && s.exited <= monthEndMs) continue;
        count += 1;
        total += deal.amount;
      }
      rows.push({
        tenant_id,
        pipeline_id,
        snapshot_month: monthKey,
        stage_id: stageId,
        stage_label: label,
        stage_order: order,
        deal_count: count,
        total_amount: Math.round(total * 100) / 100,
        computed_at: computedAt,
      });
    }

    cursor = addMonthUTC(cursor, 1);
  }

  console.log(
    `[FunnelSnapshot] computed ${rows.length} rows across months ${toMonthKey(from)} → ${toMonthKey(to)}`,
  );

  // 6. Upsert in chunks (Supabase PostgREST has a payload size cap).
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("deal_funnel_snapshots")
      .upsert(slice, {
        onConflict: "tenant_id,pipeline_id,snapshot_month,stage_id",
      });
    if (error) {
      throw new Error(`deal_funnel_snapshots upsert failed: ${error.message}`);
    }
  }

  console.log(`[FunnelSnapshot] done — upserted ${rows.length} rows`);
}
