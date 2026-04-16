"use client";

/**
 * Collapsible snapshot strip for the Account 360 dashboard.
 * Shows four stacked summary cards: Deals, Sites, Stakeholders, Open tasks.
 */

import { useState } from "react";
import { DollarSign, MapPin, Users, CheckSquare, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar } from "../ui/avatar";
import type {
  Account360Snapshot,
  Account360Site,
  Account360Stakeholder,
  Account360Task,
} from "../../lib/data/account-360-queries";
import type { StandupDeal } from "../../lib/data/meeting-queries";

interface Props {
  snapshot: Account360Snapshot;
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function PipelineStagePill({ stage }: { stage: string | null }) {
  if (!stage) return <span className="text-[10px] text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 capitalize">
      {stage.replace(/_/g, " ")}
    </span>
  );
}

export function CustomerSnapshotStrip({ snapshot }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { deals, dealTotalAmount, sites, stakeholders, openTasks } = snapshot;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 border-b border-gray-50"
      >
        <div className="flex items-center gap-6 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            <strong className="text-gray-900 font-semibold">{deals.length}</strong> deals ·{" "}
            <strong className="text-gray-900 font-semibold">{formatCurrency(dealTotalAmount)}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <strong className="text-gray-900 font-semibold">{sites.length}</strong> sites
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            <strong className="text-gray-900 font-semibold">{stakeholders.length}</strong> stakeholders
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-gray-400" />
            <strong className="text-gray-900 font-semibold">{openTasks.length}</strong> open tasks
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-50">
          {/* Deals */}
          <div className="p-4">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Open deals
            </h4>
            {deals.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic">No open deals</p>
            ) : (
              <ul className="space-y-1.5">
                {deals.slice(0, 6).map((d: StandupDeal) => (
                  <li key={d.dealId} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-gray-900 truncate">{d.dealName}</span>
                      <span className="text-gray-500 shrink-0">
                        {d.amount ? formatCurrency(Number(d.amount)) : "—"}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{d.stage}</div>
                  </li>
                ))}
                {deals.length > 6 && (
                  <li className="text-[10px] text-gray-400">+{deals.length - 6} more</li>
                )}
              </ul>
            )}
          </div>

          {/* Sites */}
          <div className="p-4">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Sites
            </h4>
            {sites.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic">No sites</p>
            ) : (
              <ul className="space-y-1.5">
                {sites.map((s: Account360Site) => (
                  <li key={s.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-900 truncate">{s.name}</span>
                      <PipelineStagePill stage={s.pipeline_stage} />
                    </div>
                    {s.next_step && (
                      <div className="text-[10px] text-gray-400 truncate">→ {s.next_step}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stakeholders */}
          <div className="p-4">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Stakeholders
            </h4>
            {stakeholders.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic">None listed</p>
            ) : (
              <ul className="space-y-1.5">
                {stakeholders.slice(0, 6).map((s: Account360Stakeholder) => (
                  <li key={s.id} className="text-xs">
                    <div className="text-gray-900 truncate">{s.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {[s.title, s.department].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </li>
                ))}
                {stakeholders.length > 6 && (
                  <li className="text-[10px] text-gray-400">+{stakeholders.length - 6} more</li>
                )}
              </ul>
            )}
          </div>

          {/* Open tasks */}
          <div className="p-4">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Open tasks
            </h4>
            {openTasks.length === 0 ? (
              <p className="text-[11px] text-gray-300 italic">No open tasks</p>
            ) : (
              <ul className="space-y-1.5">
                {openTasks.slice(0, 6).map((t: Account360Task) => (
                  <li key={t.id} className="text-xs">
                    <div className="text-gray-900 truncate">{t.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      {t.assignee && (
                        <span className="inline-flex items-center gap-1">
                          <Avatar
                            name={t.assignee.full_name}
                            src={t.assignee.avatar_url}
                            size="sm"
                            className="h-3.5 w-3.5 text-[8px]"
                          />
                          {t.assignee.full_name}
                        </span>
                      )}
                      {t.due_date && <span>· due {t.due_date}</span>}
                      {t.site_name && <span>· {t.site_name}</span>}
                    </div>
                  </li>
                ))}
                {openTasks.length > 6 && (
                  <li className="text-[10px] text-gray-400">+{openTasks.length - 6} more</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
