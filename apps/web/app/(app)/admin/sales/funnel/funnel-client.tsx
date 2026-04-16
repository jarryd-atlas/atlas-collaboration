"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "../../../../../components/ui/button";
import { triggerBackfill, triggerCurrentMonth } from "../../../../../lib/actions/deal-funnel";

export interface FunnelRow {
  snapshot_month: string; // YYYY-MM-DD
  stage_id: string;
  stage_label: string;
  stage_order: number;
  deal_count: number;
  total_amount: number;
}

interface Props {
  rows: FunnelRow[];
  canTrigger: boolean;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMonth(iso: string): string {
  // iso is YYYY-MM-01 — parse as UTC to avoid TZ drift.
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function FunnelSnapshotsClient({ rows, canTrigger }: Props) {
  const [banner, setBanner] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  // Distinct months, newest first
  const months = useMemo(() => {
    const set = new Set(rows.map((r) => r.snapshot_month));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [rows]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(
    months[0] ?? null,
  );

  // Stages ordered for the trend table (take from newest month, fall back to union)
  const stages = useMemo(() => {
    const seen = new Map<string, { stage_id: string; stage_label: string; stage_order: number }>();
    for (const r of rows) {
      if (!seen.has(r.stage_id)) {
        seen.set(r.stage_id, {
          stage_id: r.stage_id,
          stage_label: r.stage_label,
          stage_order: r.stage_order,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.stage_order - b.stage_order);
  }, [rows]);

  // Lookup: monthKey → stageId → row
  const byMonthStage = useMemo(() => {
    const m = new Map<string, Map<string, FunnelRow>>();
    for (const r of rows) {
      let inner = m.get(r.snapshot_month);
      if (!inner) {
        inner = new Map();
        m.set(r.snapshot_month, inner);
      }
      inner.set(r.stage_id, r);
    }
    return m;
  }, [rows]);

  const selectedRows = selectedMonth
    ? stages
        .map((s) => byMonthStage.get(selectedMonth)?.get(s.stage_id))
        .filter((r): r is FunnelRow => !!r)
    : [];

  const maxCount = selectedRows.reduce((m, r) => Math.max(m, r.deal_count), 0);

  function runAction(kind: "backfill" | "current") {
    setBanner(null);
    startTransition(async () => {
      const res =
        kind === "backfill" ? await triggerBackfill() : await triggerCurrentMonth();
      if (res.error) {
        setBanner({ kind: "error", text: res.error });
      } else {
        setBanner({
          kind: "success",
          text:
            kind === "backfill"
              ? "Backfill queued. Refresh in a minute to see results."
              : "Current-month refresh queued. Refresh in a minute to see results.",
        });
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        {canTrigger && (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => runAction("backfill")}
              disabled={isPending}
            >
              {isPending ? "Queueing…" : "Run backfill"}
            </Button>
          </div>
        )}
        {banner && (
          <div
            className={
              banner.kind === "success"
                ? "rounded-md bg-green-50 p-3 text-sm text-green-800"
                : "rounded-md bg-red-50 p-3 text-sm text-red-800"
            }
          >
            {banner.text}
          </div>
        )}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          No snapshots yet. {canTrigger ? "Click \u201cRun backfill\u201d to compute monthly snapshots from the earliest New Business deal through today." : "Ask a super admin to run the initial backfill."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Action bar */}
      {canTrigger && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => runAction("current")}
            disabled={isPending}
          >
            {isPending ? "Queueing…" : "Refresh current month"}
          </Button>
          <Button
            variant="outline"
            onClick={() => runAction("backfill")}
            disabled={isPending}
          >
            {isPending ? "Queueing…" : "Run backfill"}
          </Button>
        </div>
      )}
      {banner && (
        <div
          className={
            banner.kind === "success"
              ? "rounded-md bg-green-50 p-3 text-sm text-green-800"
              : "rounded-md bg-red-50 p-3 text-sm text-red-800"
          }
        >
          {banner.text}
        </div>
      )}

      {/* Month picker + funnel bars */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Funnel snapshot</h2>
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {selectedRows.map((r) => {
            const pct = maxCount > 0 ? (r.deal_count / maxCount) * 100 : 0;
            return (
              <div key={r.stage_id} className="flex items-center gap-3">
                <div className="w-52 shrink-0 text-sm text-gray-700">{r.stage_label}</div>
                <div className="relative flex-1 rounded bg-gray-100">
                  <div
                    className="h-8 rounded bg-brand-green/80"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-xs font-medium text-gray-900">
                    {r.deal_count} {r.deal_count === 1 ? "deal" : "deals"} ·{" "}
                    {formatCurrency(r.total_amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trend table */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Month-over-month trend</h2>
          <p className="text-sm text-gray-500">
            Deal count and total amount per stage, per month.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 px-4 py-2 text-left font-medium text-gray-700">
                  Stage
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="border-b border-gray-200 px-4 py-2 text-right font-medium text-gray-700 whitespace-nowrap"
                  >
                    {formatMonth(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage_id} className="even:bg-gray-50/50">
                  <td className="sticky left-0 z-10 border-b border-gray-100 bg-inherit px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {s.stage_label}
                  </td>
                  {months.map((m) => {
                    const cell = byMonthStage.get(m)?.get(s.stage_id);
                    return (
                      <td
                        key={m}
                        className="border-b border-gray-100 px-4 py-2 text-right text-gray-700 whitespace-nowrap"
                      >
                        {cell ? (
                          <>
                            <span className="font-medium text-gray-900">
                              {cell.deal_count}
                            </span>
                            <span className="ml-1 text-xs text-gray-500">
                              {formatCurrency(cell.total_amount)}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
