"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createStakeholder, updateStakeholder, deleteStakeholder } from "../../lib/actions/account-plan";
import { updateStakeholderSiteLinks } from "../../lib/actions/assessment";
import { X, Trash2, Search, Check, MapPin, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Stakeholder } from "./org-chart-node";

interface SiteOption {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  slug?: string;
}

interface StakeholderFormProps {
  stakeholder?: Stakeholder | null;
  accountPlanId: string;
  tenantId: string;
  allStakeholders: Stakeholder[];
  isCKInternal: boolean;
  defaultReportsTo?: string | null;
  sites?: SiteOption[];
  customerId?: string;
  onClose: () => void;
}

export function StakeholderForm({
  stakeholder,
  accountPlanId,
  tenantId,
  allStakeholders,
  isCKInternal,
  defaultReportsTo,
  sites = [],
  customerId,
  onClose,
}: StakeholderFormProps) {
  const isEdit = !!stakeholder;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: stakeholder?.name ?? "",
    title: stakeholder?.title ?? "",
    email: stakeholder?.email ?? "",
    phone: stakeholder?.phone ?? "",
    department: stakeholder?.department ?? "",
    stakeholder_role: stakeholder?.stakeholder_role ?? "",
    relationship_strength: stakeholder?.relationship_strength ?? "unknown",
    persona_type: stakeholder?.persona_type ?? "",
    strategy_notes: stakeholder?.strategy_notes ?? "",
    notes: stakeholder?.notes ?? "",
    reports_to: stakeholder?.reports_to ?? defaultReportsTo ?? "",
  });

  // Linked sites state
  const [linkedSiteIds, setLinkedSiteIds] = useState<Set<string>>(new Set());
  const [originalLinkedSiteIds, setOriginalLinkedSiteIds] = useState<Set<string>>(new Set());
  const [loadingSites, setLoadingSites] = useState(false);

  // Load currently linked sites on mount (edit mode only)
  useEffect(() => {
    if (!isEdit || !stakeholder?.id || sites.length === 0) return;

    setLoadingSites(true);
    fetch(`/api/contacts/linked-sites?stakeholderId=${encodeURIComponent(stakeholder.id)}`)
      .then((res) => res.json())
      .then((data) => {
        const ids = new Set<string>(data.siteIds ?? []);
        setLinkedSiteIds(ids);
        setOriginalLinkedSiteIds(new Set(ids));
      })
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, [isEdit, stakeholder?.id, sites.length]);

  // Filter out self and descendants from reports_to options to prevent circular refs
  const reportsToOptions = allStakeholders.filter((s) => s.id !== stakeholder?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const data = {
      name: form.name.trim(),
      title: form.title || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department: form.department || undefined,
      stakeholder_role: form.stakeholder_role || undefined,
      relationship_strength: form.relationship_strength || undefined,
      persona_type: form.persona_type || undefined,
      strategy_notes: form.strategy_notes || undefined,
      notes: form.notes || undefined,
      reports_to: form.reports_to || null,
    };

    let stakeholderId = stakeholder?.id;

    if (isEdit && stakeholderId) {
      await updateStakeholder(stakeholderId, data);
    } else {
      const result = await createStakeholder(accountPlanId, tenantId, data);
      // For new stakeholders, we need the ID to link sites
      if (result && typeof result === "object" && "id" in result) {
        stakeholderId = (result as { id: string }).id;
      }
    }

    // Update site links if we have sites and a stakeholder ID
    if (stakeholderId && sites.length > 0) {
      const siteIdsToAdd = [...linkedSiteIds].filter((id) => !originalLinkedSiteIds.has(id));
      const siteIdsToRemove = [...originalLinkedSiteIds].filter((id) => !linkedSiteIds.has(id));

      if (siteIdsToAdd.length > 0 || siteIdsToRemove.length > 0) {
        await updateStakeholderSiteLinks({
          stakeholderId,
          tenantId,
          siteIdsToAdd,
          siteIdsToRemove,
        });
      }
    }

    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!stakeholder || !confirm("Delete this stakeholder? Their direct reports will become top-level.")) return;
    setSaving(true);
    await deleteStakeholder(stakeholder.id);
    setSaving(false);
    onClose();
  }

  function toggleSite(siteId: string) {
    setLinkedSiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? "Edit Stakeholder" : "Add Stakeholder"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="Full name" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="VP of Operations" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Department</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="Operations" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Reports To</label>
              <ReportsToSearch
                value={form.reports_to}
                onChange={(id) => setForm({ ...form, reports_to: id })}
                options={reportsToOptions}
              />
            </div>
          </div>

          {/* Linked Sites */}
          {sites.length > 0 && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                <label className="text-[10px] font-medium text-gray-500 uppercase">Linked Sites</label>
                {loadingSites && <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />}
              </div>
              <p className="text-[11px] text-gray-400 mb-2">
                Select sites where this person is a key contact.
              </p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
                {sites.map((site) => {
                  const isLinked = linkedSiteIds.has(site.id);
                  return (
                    <label
                      key={site.id}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors",
                        isLinked ? "bg-indigo-50/50" : "hover:bg-gray-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={() => toggleSite(site.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <span className="text-sm text-gray-900">{site.name}</span>
                        {(site.city || site.state) && (
                          <span className="text-xs text-gray-400 ml-1.5">
                            {[site.city, site.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              {linkedSiteIds.size > 0 && (
                <p className="text-[11px] text-indigo-500 mt-1.5">
                  {linkedSiteIds.size} site{linkedSiteIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          {/* Internal-only fields */}
          {isCKInternal && (
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase">Internal Only</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase">Role</label>
                  <select value={form.stakeholder_role} onChange={(e) => setForm({ ...form, stakeholder_role: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                    <option value="">Not set</option>
                    <option value="champion">Champion</option>
                    <option value="decision_maker">Decision Maker</option>
                    <option value="influencer">Influencer</option>
                    <option value="blocker">Blocker</option>
                    <option value="user">User</option>
                    <option value="economic_buyer">Economic Buyer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase">Relationship</label>
                  <select value={form.relationship_strength} onChange={(e) => setForm({ ...form, relationship_strength: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                    <option value="unknown">Unknown</option>
                    <option value="strong">Strong</option>
                    <option value="good">Good</option>
                    <option value="developing">Developing</option>
                    <option value="weak">Weak</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-medium text-gray-500 uppercase">Persona Type</label>
                  <select value={form.persona_type} onChange={(e) => setForm({ ...form, persona_type: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                    <option value="">Not set</option>
                    <option value="engineering_leader">Engineering Leader</option>
                    <option value="sustainability_leader">Sustainability & Energy Leader</option>
                    <option value="fmm">Facility Maintenance Manager</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase">Strategy Notes</label>
                <textarea value={form.strategy_notes} onChange={(e) => setForm({ ...form, strategy_notes: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" rows={2} placeholder="How to engage this person..." />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" rows={2} />
          </div>

          <div className="flex items-center justify-between pt-2">
            {isEdit && isCKInternal ? (
              <button type="button" onClick={handleDelete} disabled={saving} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" disabled={saving || !form.name.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {saving ? "Saving..." : isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Searchable Reports To Combobox ──────────────────────────

function ReportsToSearch({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Stakeholder[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((s) => s.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-0.5">
      {/* Display / trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm border border-gray-200 rounded-md text-left hover:border-gray-300 transition-colors"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? `${selected.name}${selected.title ? ` — ${selected.title}` : ""}` : "None (top-level)"}
        </span>
        <Search className="h-3 w-3 text-gray-400 shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="px-2.5 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-md">
              <Search className="h-3 w-3 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, title, or department..."
                className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {/* None option */}
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                !value && "bg-gray-50"
              )}
            >
              {!value && <Check className="h-3 w-3 text-gray-900 shrink-0" />}
              {value && <span className="w-3 shrink-0" />}
              <span className="text-gray-500 italic">None (top-level)</span>
            </button>

            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors",
                  s.id === value && "bg-gray-50"
                )}
              >
                {s.id === value ? (
                  <Check className="h-3 w-3 text-gray-900 shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{s.name}</span>
                  {s.title && <span className="text-gray-400 ml-1">— {s.title}</span>}
                  {s.department && (
                    <span className="text-[10px] text-gray-400 ml-1.5">({s.department})</span>
                  )}
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
