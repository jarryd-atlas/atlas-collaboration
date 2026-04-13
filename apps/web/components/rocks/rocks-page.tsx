"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight, Target, Search } from "lucide-react";
import { QuarterPicker } from "./quarter-picker";
import { RockCard } from "./rock-card";
import { RockForm } from "./rock-form";
import { RockStatusBadge } from "./rock-status-badge";
import { linkRockToParent, unlinkRockFromParent } from "../../lib/actions/rocks";
import type { RockRow } from "../../lib/data/rock-queries";
import { cn } from "../../lib/utils";

type RockLevel = "company" | "department" | "team" | "individual";
type FilterMode = "all" | "mine";

const LEVEL_CONFIG: Record<RockLevel, { label: string; pluralLabel: string; color: string }> = {
  company: { label: "Company", pluralLabel: "Company Rocks", color: "text-purple-600" },
  department: { label: "Department", pluralLabel: "Department Rocks", color: "text-blue-600" },
  team: { label: "Team", pluralLabel: "Team Rocks", color: "text-amber-600" },
  individual: { label: "Individual", pluralLabel: "Individual Rocks", color: "text-gray-600" },
};

const LEVELS_ORDERED: RockLevel[] = ["company", "department", "team", "individual"];

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface RocksPageProps {
  rocks: RockRow[];
  quarter: number;
  year: number;
  currentUserId: string;
  teamMembers: TeamMember[];
  teamSuggestions: string[];
  departmentSuggestions: string[];
}

export function RocksPage({
  rocks,
  quarter,
  year,
  currentUserId,
  teamMembers,
  teamSuggestions,
  departmentSuggestions,
}: RocksPageProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<RockLevel>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingRock, setEditingRock] = useState<RockRow | null>(null);
  const [linkingRock, setLinkingRock] = useState<RockRow | null>(null);

  // Filter rocks
  const filtered = useMemo(() => {
    if (filter === "mine") {
      return rocks.filter(
        (r) =>
          r.owner_id === currentUserId ||
          r.collaborators?.some((c) => c.id === currentUserId),
      );
    }
    return rocks;
  }, [rocks, filter, currentUserId]);

  // Separate "collaborating on" rocks for My Rocks view
  const collaboratingRocks = useMemo(() => {
    if (filter !== "mine") return [];
    return rocks.filter(
      (r) =>
        r.owner_id !== currentUserId &&
        r.collaborators?.some((c) => c.id === currentUserId),
    );
  }, [rocks, filter, currentUserId]);

  const collaboratingIds = useMemo(
    () => new Set(collaboratingRocks.map((r) => r.id)),
    [collaboratingRocks],
  );

  // Group by level (exclude collaborating-only rocks from main groups in "mine" view)
  const grouped = useMemo(() => {
    const map = new Map<RockLevel, RockRow[]>();
    for (const level of LEVELS_ORDERED) {
      map.set(level, []);
    }
    for (const rock of filtered) {
      if (filter === "mine" && collaboratingIds.has(rock.id)) continue;
      const list = map.get(rock.level as RockLevel);
      if (list) list.push(rock);
    }
    return map;
  }, [filtered, filter, collaboratingIds]);

  // Build parent→children lookup
  const childrenOf = useMemo(() => {
    const map = new Map<string, RockRow[]>();
    for (const rock of rocks) {
      if (rock.parent_rock_id) {
        const existing = map.get(rock.parent_rock_id) ?? [];
        existing.push(rock);
        map.set(rock.parent_rock_id, existing);
      }
    }
    return map;
  }, [rocks]);

  // Build id→rock lookup
  const rockById = useMemo(() => {
    const map = new Map<string, RockRow>();
    for (const rock of rocks) {
      map.set(rock.id, rock);
    }
    return map;
  }, [rocks]);

  const toggleSection = useCallback((level: RockLevel) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const handleEdit = useCallback((rock: RockRow) => {
    setEditingRock(rock);
    setShowForm(true);
  }, []);

  const handleLink = useCallback((rock: RockRow) => {
    setLinkingRock(rock);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingRock(null);
  }, []);

  // Stats
  const totalCount = filtered.length;
  const completeCount = filtered.filter((r) => r.status === "complete").length;
  const onTrackCount = filtered.filter((r) => r.status === "on_track").length;
  const offTrackCount = filtered.filter((r) => r.status === "off_track").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">Quarterly Rocks</h1>
        </div>
        <QuarterPicker year={year} quarter={quarter} />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{totalCount} rocks</span>
        {onTrackCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            {onTrackCount} on track
          </span>
        )}
        {offTrackCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {offTrackCount} off track
          </span>
        )}
        {completeCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            {completeCount} complete
          </span>
        )}
      </div>

      {/* Filter tabs + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              filter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            All Rocks
          </button>
          <button
            onClick={() => setFilter("mine")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded-md transition-colors",
              filter === "mine" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            My Rocks
          </button>
        </div>
        <button
          onClick={() => { setEditingRock(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rock
        </button>
      </div>

      {/* Grouped sections */}
      {totalCount === 0 ? (
        <div className="text-center py-16">
          <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No rocks for Q{quarter} {year}</p>
          <p className="text-xs text-gray-400">Click "Add Rock" to define your first quarterly rock.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {LEVELS_ORDERED.map((level) => {
            const levelRocks = grouped.get(level) ?? [];
            if (levelRocks.length === 0) return null;

            const config = LEVEL_CONFIG[level];
            const isCollapsed = collapsedSections.has(level);
            const levelComplete = levelRocks.filter((r) => r.status === "complete").length;

            return (
              <div key={level}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(level)}
                  className="flex items-center gap-2 w-full text-left mb-2 group"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                  <h2 className={cn("text-sm font-semibold", config.color)}>
                    {config.pluralLabel}
                  </h2>
                  <span className="text-xs text-gray-400">
                    {levelRocks.length}
                  </span>
                  {/* Progress bar — only show when at least one is complete */}
                  {levelComplete > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-green rounded-full transition-all"
                          style={{ width: `${(levelComplete / levelRocks.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {levelComplete}/{levelRocks.length}
                      </span>
                    </div>
                  )}
                </button>

                {/* Rock cards */}
                {!isCollapsed && (
                  <div className="space-y-2 ml-2">
                    {levelRocks.map((rock) => (
                      <RockCard
                        key={rock.id}
                        rock={rock}
                        children_rocks={childrenOf.get(rock.id) ?? []}
                        parentRock={rock.parent_rock_id ? rockById.get(rock.parent_rock_id) ?? null : null}
                        onEdit={handleEdit}
                        onLink={handleLink}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Collaborating On section (My Rocks view only) */}
          {filter === "mine" && collaboratingRocks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-teal-600">
                  Collaborating On
                </h2>
                <span className="text-xs text-gray-400">
                  {collaboratingRocks.length}
                </span>
              </div>
              <div className="space-y-2 ml-2">
                {collaboratingRocks.map((rock) => (
                  <RockCard
                    key={rock.id}
                    rock={rock}
                    children_rocks={childrenOf.get(rock.id) ?? []}
                    parentRock={rock.parent_rock_id ? rockById.get(rock.parent_rock_id) ?? null : null}
                    onEdit={handleEdit}
                    onLink={handleLink}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rock form modal */}
      {showForm && (
        <RockForm
          rock={editingRock}
          quarter={quarter}
          year={year}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          allRocks={rocks}
          teamSuggestions={teamSuggestions}
          departmentSuggestions={departmentSuggestions}
          onClose={handleCloseForm}
        />
      )}

      {/* Link to parent modal */}
      {linkingRock && (
        <LinkParentModal
          rock={linkingRock}
          allRocks={rocks}
          onClose={() => setLinkingRock(null)}
        />
      )}
    </div>
  );
}

// ─── Link Parent Modal ────────────────────────────────────

function LinkParentModal({
  rock,
  allRocks,
  onClose,
}: {
  rock: RockRow;
  allRocks: RockRow[];
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [search, setSearch] = useState("");

  const LEVEL_ORDER: Record<string, number> = { company: 0, department: 1, team: 2, individual: 3 };
  const parentOptions = allRocks.filter(
    (r) =>
      r.id !== rock.id &&
      (LEVEL_ORDER[r.level] ?? 9) < (LEVEL_ORDER[rock.level] ?? 9) &&
      r.quarter === rock.quarter &&
      r.year === rock.year,
  );

  const filtered = search.trim()
    ? parentOptions.filter((r) => r.title.toLowerCase().includes(search.toLowerCase()))
    : parentOptions;

  const handleSelect = async (parentId: string) => {
    setIsPending(true);
    await linkRockToParent(rock.id, parentId);
    setIsPending(false);
    onClose();
  };

  const handleUnlink = async () => {
    setIsPending(true);
    await unlinkRockFromParent(rock.id);
    setIsPending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Link &ldquo;{rock.title}&rdquo; to Parent
          </h2>
        </div>
        {parentOptions.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-gray-500">
              No higher-level rocks available in Q{rock.quarter} {rock.year}.
              Create a {rock.level === "individual" ? "team, department, or company" : rock.level === "team" ? "department or company" : "company"} rock first.
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rocks..."
                  className="flex-1 text-sm outline-none placeholder:text-gray-400"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 pb-3 space-y-2 max-h-[300px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No matching rocks</p>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelect(r.id)}
                    disabled={isPending}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-2",
                      rock.parent_rock_id === r.id && "ring-2 ring-brand-green bg-green-50",
                    )}
                  >
                    <RockStatusBadge status={r.status} />
                    <span className="text-sm text-gray-900 flex-1 truncate">{r.title}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{r.level}</span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          {rock.parent_rock_id && (
            <button
              onClick={handleUnlink}
              disabled={isPending}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Unlink from parent
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
