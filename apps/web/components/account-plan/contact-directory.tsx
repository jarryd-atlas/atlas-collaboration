"use client";

import { useState, useMemo } from "react";
import { Search, X, ArrowUpDown, Mail, Phone, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Stakeholder } from "./org-chart-node";

interface ContactDirectoryProps {
  stakeholders: Stakeholder[];
  isCKInternal: boolean;
  onEdit: (stakeholder: Stakeholder) => void;
  onAdd: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  champion: "bg-green-100 text-green-700",
  decision_maker: "bg-purple-100 text-purple-700",
  influencer: "bg-blue-100 text-blue-700",
  blocker: "bg-red-100 text-red-700",
  user: "bg-gray-100 text-gray-600",
  economic_buyer: "bg-amber-100 text-amber-700",
};

const ROLE_LABELS: Record<string, string> = {
  champion: "Champion",
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  blocker: "Blocker",
  user: "User",
  economic_buyer: "Econ. Buyer",
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-green-500",
  good: "bg-green-300",
  developing: "bg-amber-400",
  weak: "bg-red-400",
  unknown: "bg-gray-300",
};

const PERSONA_COLORS: Record<string, string> = {
  engineering_leader: "bg-indigo-100 text-indigo-700",
  sustainability_leader: "bg-teal-100 text-teal-700",
  fmm: "bg-orange-100 text-orange-700",
};

const PERSONA_LABELS: Record<string, string> = {
  engineering_leader: "Eng. Leader",
  sustainability_leader: "Sustainability",
  fmm: "FMM",
};

type SortKey = "name" | "title" | "department" | "role";

export function ContactDirectory({ stakeholders, isCKInternal, onEdit, onAdd }: ContactDirectoryProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let result = stakeholders;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.email?.toLowerCase().includes(q) ?? false) ||
          (s.title?.toLowerCase().includes(q) ?? false) ||
          (s.department?.toLowerCase().includes(q) ?? false)
      );
    }

    result = [...result].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortKey) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "title": aVal = a.title ?? ""; bVal = b.title ?? ""; break;
        case "department": aVal = a.department ?? ""; bVal = b.department ?? ""; break;
        case "role": aVal = a.stakeholder_role ?? ""; bVal = b.stakeholder_role ?? ""; break;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [stakeholders, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const SortHeader = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors",
        className
      )}
    >
      {label}
      <ArrowUpDown className={cn("h-3 w-3", sortKey === field ? "text-gray-600" : "text-gray-300")} />
    </button>
  );

  const enrichedCount = stakeholders.filter((s) => s.title || s.department || s.stakeholder_role).length;
  const autoCount = stakeholders.filter((s) => s.is_ai_suggested).length;

  return (
    <div className="p-4">
      {/* Search + stats */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-400 hidden sm:flex items-center gap-3">
          <span>{stakeholders.length} contacts</span>
          {autoCount > 0 && (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-400" />
              {autoCount} auto-discovered
            </span>
          )}
          <span>{enrichedCount} enriched</span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {search ? "No contacts match your search." : "No contacts yet."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
          {/* Header */}
          <div className={cn(
            "grid gap-x-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50",
            isCKInternal
              ? "grid-cols-[1fr_1fr_1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_0.7fr_0.7fr_auto]"
              : "grid-cols-[1fr_1fr_1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto]"
          )}>
            <SortHeader label="Name" field="name" />
            <SortHeader label="Title" field="title" className="hidden sm:flex" />
            <SortHeader label="Department" field="department" />
            {isCKInternal && <SortHeader label="Role" field="role" />}
            {isCKInternal && <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:block">Persona</span>}
            <div className="w-8" /> {/* spacer for icons */}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => onEdit(s)}
                className={cn(
                  "w-full grid gap-x-4 px-4 py-3 text-left hover:bg-gray-50 transition-colors group",
                  isCKInternal
                    ? "grid-cols-[1fr_1fr_1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_0.7fr_0.7fr_auto]"
                    : "grid-cols-[1fr_1fr_1fr_auto] sm:grid-cols-[1.5fr_1fr_1fr_auto]"
                )}
              >
                {/* Name + email */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    {s.is_ai_suggested && (
                      <span title="Auto-discovered"><Sparkles className="h-3 w-3 text-blue-400 shrink-0" /></span>
                    )}
                  </div>
                  {s.email && (
                    <p className="text-[11px] text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <Mail className="h-2.5 w-2.5 shrink-0" />
                      {s.email}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div className="hidden sm:block min-w-0 self-center">
                  <p className="text-xs text-gray-600 truncate">{s.title ?? "—"}</p>
                </div>

                {/* Department */}
                <div className="min-w-0 self-center">
                  <p className="text-xs text-gray-500 truncate">{s.department ?? "—"}</p>
                </div>

                {/* Role + strength (internal only) */}
                {isCKInternal && (
                  <div className="flex items-center gap-1.5 self-center">
                    {s.stakeholder_role ? (
                      <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", ROLE_COLORS[s.stakeholder_role] ?? "bg-gray-100 text-gray-500")}>
                        {ROLE_LABELS[s.stakeholder_role] ?? s.stakeholder_role}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                    {s.relationship_strength && (
                      <span className={cn("w-2 h-2 rounded-full shrink-0", STRENGTH_COLORS[s.relationship_strength] ?? "bg-gray-300")} title={`Relationship: ${s.relationship_strength}`} />
                    )}
                  </div>
                )}

                {/* Persona type (internal only) */}
                {isCKInternal && (
                  <div className="hidden sm:flex items-center self-center">
                    {s.persona_type ? (
                      <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", PERSONA_COLORS[s.persona_type] ?? "bg-gray-100 text-gray-500")}>
                        {PERSONA_LABELS[s.persona_type] ?? s.persona_type}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-300">—</span>
                    )}
                  </div>
                )}

                {/* Contact icons */}
                <div className="flex items-center gap-1 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {s.phone && (
                    <span title={s.phone}><Phone className="h-3 w-3 text-gray-300" /></span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
