"use client";

import {
  DISCOVERY_SECTIONS,
  DISCOVERY_SECTION_LABELS,
  SECTION_STATUS_LABELS,
  SECTION_STATUS_COLORS,
} from "@repo/shared";
import type { SectionStatus, DiscoverySection } from "@repo/shared";
import { CheckCircle2, Clock, AlertCircle, Circle } from "lucide-react";

interface SectionStatusRow {
  section_key: string;
  status: SectionStatus;
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface DiscoveryScorecardProps {
  sectionStatuses: SectionStatusRow[];
  isInternal: boolean;
  openInfoRequestCount?: number;
}

const STATUS_ICONS: Record<SectionStatus, React.ReactNode> = {
  not_started: <Circle className="h-3 w-3 text-gray-400" />,
  in_progress: <Clock className="h-3 w-3 text-blue-500" />,
  needs_review: <AlertCircle className="h-3 w-3 text-amber-500" />,
  complete: <CheckCircle2 className="h-3 w-3 text-green-500" />,
};

export function DiscoveryScorecard({ sectionStatuses, isInternal, openInfoRequestCount = 0 }: DiscoveryScorecardProps) {
  // Build a map for quick lookup
  const statusMap = new Map<string, SectionStatusRow>();
  for (const s of sectionStatuses) {
    statusMap.set(s.section_key, s);
  }

  // Count statuses
  const counts: Record<SectionStatus, number> = {
    not_started: 0,
    in_progress: 0,
    needs_review: 0,
    complete: 0,
  };

  for (const section of DISCOVERY_SECTIONS) {
    const row = statusMap.get(section);
    const status = row?.status ?? "not_started";
    counts[status]++;
  }

  const total = DISCOVERY_SECTIONS.length;
  const completePct = total > 0 ? Math.round((counts.complete / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-4">
      <div className="flex items-center gap-6">
        {/* Completion ring */}
        <div className="relative flex-shrink-0">
          <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="#91E100"
              strokeWidth="3"
              strokeDasharray={`${completePct} ${100 - completePct}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900">{counts.complete}/{total}</span>
          </div>
        </div>

        {/* Status counts */}
        <div className="flex items-center gap-4 flex-wrap">
          {(["complete", "in_progress", "needs_review", "not_started"] as SectionStatus[]).map((s) => {
            const colors = SECTION_STATUS_COLORS[s];
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                <span className="text-xs text-gray-500">
                  {SECTION_STATUS_LABELS[s]}
                </span>
                <span className="text-xs font-semibold text-gray-700">{counts[s]}</span>
              </div>
            );
          })}
          {openInfoRequestCount > 0 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-xs text-gray-500">Requests</span>
              <span className="text-xs font-semibold text-amber-700">{openInfoRequestCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section breakdown — compact row of pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DISCOVERY_SECTIONS.map((key) => {
          const row = statusMap.get(key);
          const status = (row?.status ?? "not_started") as SectionStatus;
          const colors = SECTION_STATUS_COLORS[status];
          const assignee = row?.assignee;

          return (
            <div
              key={key}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${colors.bg} ${colors.text}`}
              title={`${DISCOVERY_SECTION_LABELS[key]}: ${SECTION_STATUS_LABELS[status]}${assignee?.full_name ? ` — ${assignee.full_name}` : ""}`}
            >
              {STATUS_ICONS[status]}
              <span className="font-medium">{DISCOVERY_SECTION_LABELS[key]}</span>
              {assignee?.full_name && isInternal && (
                <>
                  <span className="text-[10px] opacity-70">·</span>
                  {assignee.avatar_url ? (
                    <img src={assignee.avatar_url} alt="" className="h-3.5 w-3.5 rounded-full" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full bg-white/50 text-[9px] font-bold flex items-center justify-center">
                      {assignee.full_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
