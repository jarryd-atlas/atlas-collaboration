/**
 * Monthly deal funnel snapshot computation.
 *
 * Pulls every deal from a HubSpot pipeline (currently only New Business is
 * supported) along with `hs_date_entered_<stageId>` / `hs_date_exited_<stageId>`
 * history fields, then reconstructs month-end stage membership for every month
 * from `from` to `to` inclusive.
 *
 * Caveat: `amount` is the *current* deal amount, not the historical value at
 * snapshot time. HubSpot does not expose per-stage historical amounts outside
 * of Enterprise-tier stage-history add-ons.
 */

import { listAllDeals } from "./client";
import {
  NEW_BUSINESS_PIPELINE_ID,
  NEW_BUSINESS_STAGE_ORDER,
  DEAL_STAGE_LABELS,
} from "./constants";
import type { HubSpotDeal } from "./types";

export interface FunnelSnapshotRow {
  pipeline_id: string;
  snapshot_month: string; // ISO date, first day of month (YYYY-MM-01)
  stage_id: string;
  stage_label: string;
  stage_order: number;
  deal_count: number;
  total_amount: number;
}

export interface ComputeRange {
  /** Earliest month (first day) to compute. */
  from: Date;
  /** Latest month (first day) to compute. */
  to: Date;
}

// ─── Helpers ───────────────────────────────────────────────

/** First day of the given month in UTC. */
function firstOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Last millisecond of the given month in UTC (for "in stage as of month end"). */
function lastMsOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1);
}

/** Advance one month (UTC). */
function addMonthUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** YYYY-MM-01 string for DB `date` column. */
function toMonthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function parseTs(value: string | undefined | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function parseNum(value: string | undefined | null): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ─── Main computation ─────────────────────────────────────

/**
 * Compute month-end funnel snapshots for a pipeline over a range.
 *
 * @param token       HubSpot private-app access token
 * @param pipelineId  HubSpot pipeline id (currently only NEW_BUSINESS_PIPELINE_ID is supported)
 * @param range       Inclusive month range. If omitted, computes from the earliest deal's
 *                    createdate through the current month.
 */
export async function computeFunnelSnapshots(
  token: string,
  pipelineId: string,
  range?: Partial<ComputeRange>,
): Promise<FunnelSnapshotRow[]> {
  if (pipelineId !== NEW_BUSINESS_PIPELINE_ID) {
    throw new Error(
      `computeFunnelSnapshots: only NEW_BUSINESS_PIPELINE_ID is supported (got ${pipelineId})`,
    );
  }

  // 1. Build property list: base + hs_date_entered_* + hs_date_exited_* for each stage.
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

  // 2. Pull every deal (listAllDeals paginates).
  const allDeals = await listAllDeals(token, properties);

  // 3. Keep only deals in the New Business pipeline.
  const deals = allDeals.filter(
    (d) => d.properties?.pipeline === pipelineId,
  );

  if (deals.length === 0) return [];

  // 4. Determine month range.
  const from =
    range?.from ??
    earliestCreateMonth(deals) ??
    firstOfMonthUTC(new Date());
  const to = range?.to ?? firstOfMonthUTC(new Date());

  // 5. Pre-parse stage entry/exit timestamps per deal for fast lookup.
  interface PreparedDeal {
    amount: number;
    stages: Map<string, { entered: number | null; exited: number | null }>;
  }
  const prepared: PreparedDeal[] = deals.map((d) => {
    const stages = new Map<string, { entered: number | null; exited: number | null }>();
    for (const stageId of stageIds) {
      stages.set(stageId, {
        entered: parseTs(d.properties?.[`hs_date_entered_${stageId}`] as string),
        exited: parseTs(d.properties?.[`hs_date_exited_${stageId}`] as string),
      });
    }
    return {
      amount: parseNum(d.properties?.amount as string),
      stages,
    };
  });

  // 6. Walk each month end, bucket deals into stages.
  const rows: FunnelSnapshotRow[] = [];
  let cursor = firstOfMonthUTC(from);
  const end = firstOfMonthUTC(to);

  while (cursor.getTime() <= end.getTime()) {
    const monthKey = toMonthKey(cursor);
    const monthEndMs = lastMsOfMonthUTC(cursor).getTime();

    for (const { id: stageId, order } of NEW_BUSINESS_STAGE_ORDER) {
      let count = 0;
      let total = 0;

      for (const deal of prepared) {
        const s = deal.stages.get(stageId);
        if (!s) continue;
        if (s.entered === null) continue;
        if (s.entered > monthEndMs) continue;
        if (s.exited !== null && s.exited <= monthEndMs) continue;
        count += 1;
        total += deal.amount;
      }

      rows.push({
        pipeline_id: pipelineId,
        snapshot_month: monthKey,
        stage_id: stageId,
        stage_label: DEAL_STAGE_LABELS[stageId] ?? stageId,
        stage_order: order,
        deal_count: count,
        total_amount: Math.round(total * 100) / 100,
      });
    }

    cursor = addMonthUTC(cursor, 1);
  }

  return rows;
}

/** Earliest deal createdate rounded down to the first of its month. */
function earliestCreateMonth(deals: HubSpotDeal[]): Date | null {
  let earliest: number | null = null;
  for (const d of deals) {
    const t = parseTs(d.properties?.createdate as string);
    if (t === null) continue;
    if (earliest === null || t < earliest) earliest = t;
  }
  if (earliest === null) return null;
  return firstOfMonthUTC(new Date(earliest));
}
