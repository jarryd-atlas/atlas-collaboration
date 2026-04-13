"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { createRock, updateRock, setRockCollaborators } from "../../lib/actions/rocks";
import { ROCK_STATUSES, type RockStatus } from "./rock-status-badge";
import { RockStatusBadge } from "./rock-status-badge";
import type { RockRow } from "../../lib/data/rock-queries";
import { cn } from "../../lib/utils";

type RockLevel = "individual" | "team" | "department" | "company";

const LEVELS: { value: RockLevel; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "department", label: "Department" },
  { value: "team", label: "Team" },
  { value: "individual", label: "Individual" },
];

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface RockFormProps {
  rock?: RockRow | null;
  quarter: number;
  year: number;
  teamMembers: TeamMember[];
  currentUserId: string;
  allRocks: RockRow[];
  teamSuggestions: string[];
  departmentSuggestions: string[];
  onClose: () => void;
}

// ─── Searchable Single-Select Dropdown ────────────────────

function SearchableSelect<T extends { id: string }>({
  value,
  onChange,
  items,
  renderItem,
  renderSelected,
  placeholder,
  searchPlaceholder,
  allowClear,
}: {
  value: string;
  onChange: (id: string) => void;
  items: T[];
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderSelected: (item: T) => React.ReactNode;
  placeholder: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selectedItem = items.find((i) => i.id === value);

  const filtered = search.trim()
    ? items.filter((i) => {
        const text = JSON.stringify(i).toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : items;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 bg-white"
      >
        {selectedItem ? (
          renderSelected(selectedItem)
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder ?? "Search..."}
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-400 italic",
                  !value && "bg-gray-50",
                )}
              >
                None
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No results</div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.id); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                    item.id === value && "bg-brand-green/5",
                  )}
                >
                  {renderItem(item, item.id === value)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Searchable Multi-Select Dropdown ─────────────────────

function SearchableMultiSelect<T extends { id: string }>({
  values,
  onChange,
  items,
  renderItem,
  renderChip,
  placeholder,
  searchPlaceholder,
}: {
  values: string[];
  onChange: (ids: string[]) => void;
  items: T[];
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderChip: (item: T) => React.ReactNode;
  placeholder: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const valuesSet = new Set(values);
  const selectedItems = items.filter((i) => valuesSet.has(i.id));

  const filtered = search.trim()
    ? items.filter((i) => {
        const text = JSON.stringify(i).toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : items;

  const toggle = (id: string) => {
    if (valuesSet.has(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  const remove = (id: string) => {
    onChange(values.filter((v) => v !== id));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-left flex items-center gap-1 flex-wrap min-h-[38px] focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 bg-white"
      >
        {selectedItems.length === 0 ? (
          <span className="text-gray-400">{placeholder}</span>
        ) : (
          selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-700"
            >
              {renderChip(item)}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder ?? "Search..."}
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No results</div>
            ) : (
              filtered.map((item) => {
                const isSelected = valuesSet.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                      isSelected && "bg-brand-green/5",
                    )}
                  >
                    {renderItem(item, isSelected)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rock Form ────────────────────────────────────────────

export function RockForm({
  rock,
  quarter,
  year,
  teamMembers,
  currentUserId,
  allRocks,
  teamSuggestions,
  departmentSuggestions,
  onClose,
}: RockFormProps) {
  const isEditing = !!rock;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(rock?.title ?? "");
  const [description, setDescription] = useState(rock?.description ?? "");
  const [level, setLevel] = useState<RockLevel>(rock?.level ?? "individual");
  const [status, setStatus] = useState<RockStatus>(rock?.status ?? "on_track");
  const [ownerId, setOwnerId] = useState(
    rock?.owner_id ?? (level === "individual" ? currentUserId : ""),
  );
  const [parentRockId, setParentRockId] = useState(rock?.parent_rock_id ?? "");
  const [teamName, setTeamName] = useState(rock?.team_name ?? "");
  const [departmentName, setDepartmentName] = useState(rock?.department_name ?? "");
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(
    rock?.collaborators?.map((c) => c.id) ?? [],
  );

  // Filter parent rocks to only show higher-level rocks in same quarter
  const LEVEL_ORDER: Record<string, number> = { company: 0, department: 1, team: 2, individual: 3 };
  const parentOptions = allRocks.filter(
    (r) =>
      r.id !== rock?.id &&
      (LEVEL_ORDER[r.level] ?? 9) < (LEVEL_ORDER[level] ?? 9) &&
      r.quarter === quarter &&
      r.year === year,
  );

  const handleLevelChange = (newLevel: RockLevel) => {
    setLevel(newLevel);
    setParentRockId(""); // Reset parent when level changes
    if (!isEditing) {
      if (newLevel === "individual") {
        setOwnerId(currentUserId);
      } else {
        setOwnerId("");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (level === "individual" && !ownerId) {
      setError("Owner is required for individual rocks");
      return;
    }
    setError(null);

    startTransition(async () => {
      if (isEditing) {
        const result = await updateRock(rock.id, {
          title: title.trim(),
          description: description.trim() || null,
          level,
          status,
          owner_id: ownerId || null,
          parent_rock_id: parentRockId || null,
          team_name: teamName || null,
          department_name: departmentName || null,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        // Update collaborators
        await setRockCollaborators(rock.id, collaboratorIds);
      } else {
        const fd = new FormData();
        fd.set("title", title.trim());
        fd.set("description", description.trim());
        fd.set("level", level);
        fd.set("quarter", String(quarter));
        fd.set("year", String(year));
        if (ownerId) fd.set("ownerId", ownerId);
        if (parentRockId) fd.set("parentRockId", parentRockId);
        if (teamName) fd.set("teamName", teamName);
        if (departmentName) fd.set("departmentName", departmentName);
        if (collaboratorIds.length > 0) fd.set("collaboratorIds", collaboratorIds.join(","));

        const result = await createRock(fd);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      onClose();
    });
  };

  // Wrap team members for SearchableSelect
  const memberItems = teamMembers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    avatarUrl: m.avatarUrl,
    email: m.email,
  }));

  // Exclude owner from collaborator options
  const collaboratorOptions = memberItems.filter((m) => m.id !== ownerId);

  // Wrap parent rocks for SearchableSelect
  const parentItems = parentOptions.map((r) => ({
    id: r.id,
    title: r.title,
    level: r.level,
    status: r.status,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? "Edit Rock" : "Add Rock"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be accomplished this quarter?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key milestones, success criteria, or details..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 resize-none"
            />
          </div>

          {/* Level + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Level *</label>
              <select
                value={level}
                onChange={(e) => handleLevelChange(e.target.value as RockLevel)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            {isEditing && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RockStatus)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                >
                  {ROCK_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Owner - searchable */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Owner {level === "individual" && "*"}
            </label>
            <SearchableSelect
              value={ownerId}
              onChange={(id) => {
                setOwnerId(id);
                // Remove from collaborators if selected as owner
                if (id) setCollaboratorIds((prev) => prev.filter((cid) => cid !== id));
              }}
              items={memberItems}
              placeholder={level === "individual" ? "Select owner..." : "No owner"}
              searchPlaceholder="Search by name or email..."
              allowClear={level !== "individual"}
              renderSelected={(item) => (
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-5 w-5 rounded-full shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-medium text-gray-600 shrink-0">
                      {item.fullName?.[0] ?? "?"}
                    </div>
                  )}
                  <span className="text-gray-900 truncate">{item.fullName}</span>
                </span>
              )}
              renderItem={(item, isSelected) => (
                <>
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-5 w-5 rounded-full shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-medium text-gray-600 shrink-0">
                      {item.fullName?.[0] ?? "?"}
                    </div>
                  )}
                  <span className="flex-1 truncate text-gray-900">{item.fullName}</span>
                  <span className="text-xs text-gray-400 truncate">{item.email}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-brand-green shrink-0" />}
                </>
              )}
            />
          </div>

          {/* Collaborators - multi-select */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Collaborators</label>
            <SearchableMultiSelect
              values={collaboratorIds}
              onChange={setCollaboratorIds}
              items={collaboratorOptions}
              placeholder="Add collaborators..."
              searchPlaceholder="Search by name or email..."
              renderChip={(item) => (
                <span className="flex items-center gap-1">
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-gray-300 flex items-center justify-center text-[8px] font-medium text-gray-600">
                      {item.fullName?.[0] ?? "?"}
                    </div>
                  )}
                  {item.fullName?.split(" ")[0]}
                </span>
              )}
              renderItem={(item, isSelected) => (
                <>
                  <div className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSelected ? "bg-brand-green border-brand-green" : "border-gray-300",
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {item.avatarUrl ? (
                    <img src={item.avatarUrl} alt="" className="h-5 w-5 rounded-full shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-medium text-gray-600 shrink-0">
                      {item.fullName?.[0] ?? "?"}
                    </div>
                  )}
                  <span className="flex-1 truncate text-gray-900">{item.fullName}</span>
                  <span className="text-xs text-gray-400 truncate">{item.email}</span>
                </>
              )}
            />
          </div>

          {/* Team name (for team/department level) */}
          {(level === "team" || level === "department") && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Team</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Engineering, Sales"
                list="team-suggestions"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              <datalist id="team-suggestions">
                {teamSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          )}

          {/* Department name (for department level) */}
          {level === "department" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="e.g. Operations, Product"
                list="dept-suggestions"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              <datalist id="dept-suggestions">
                {departmentSuggestions.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          )}

          {/* Parent rock - searchable (for non-company level) */}
          {level !== "company" && parentItems.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rolls Up To
              </label>
              <SearchableSelect
                value={parentRockId}
                onChange={setParentRockId}
                items={parentItems}
                placeholder="None"
                searchPlaceholder="Search parent rocks..."
                allowClear
                renderSelected={(item) => (
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    <RockStatusBadge status={item.status as any} />
                    <span className="text-gray-900 truncate">{item.title}</span>
                    <span className="text-[10px] text-gray-400 capitalize shrink-0">{item.level}</span>
                  </span>
                )}
                renderItem={(item, isSelected) => (
                  <>
                    <RockStatusBadge status={item.status as any} />
                    <span className="flex-1 truncate text-gray-900">{item.title}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{item.level}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-brand-green shrink-0" />}
                  </>
                )}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
                isPending
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-gray-800",
              )}
            >
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Rock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
