"use client";

import { useState, useRef, useTransition, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, User, MapPin, Building2 } from "lucide-react";
import { createTaskInline } from "../../lib/actions";
import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";

export interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

export interface AssignableSite {
  id: string;
  name: string;
  slug?: string;
}

export interface AssignableCustomer {
  id: string;
  name: string;
  tenant_id: string;
}

interface InlineTaskInputProps {
  /** Milestone to associate tasks with */
  milestoneId?: string;
  /** Site to associate tasks with */
  siteId?: string;
  /** Customer to associate tasks with (company-level tasks) */
  customerId?: string;
  /** Tenant ID (required) */
  tenantId: string;
  /** Users available for assignment */
  assignableUsers?: AssignableUser[];
  /** Sites available for assignment */
  assignableSites?: AssignableSite[];
  /** Customers available for @ mention */
  assignableCustomers?: AssignableCustomer[];
  /** Placeholder text */
  placeholder?: string;
  /** Called after a task is created */
  onTaskCreated?: () => void;
  /** Called when a customer is selected via @ mention */
  onCustomerChange?: (customer: AssignableCustomer | null) => void;
  /** Called when a site is selected via @ mention */
  onSiteChange?: (siteId: string | null) => void;
  /** Show AI expand option */
  showAiExpand?: boolean;
  /** Auto-focus the input on mount */
  autoFocus?: boolean;
}

/**
 * Notion-like inline task input with @ mention support.
 * - Type a task title and press Enter to create
 * - Type @ to trigger a mention picker for people and sites
 * - Selected mentions appear as chips below the input
 * - Escape to cancel
 */
export function InlineTaskInput({
  milestoneId,
  siteId,
  customerId,
  tenantId,
  assignableUsers = [],
  assignableSites = [],
  assignableCustomers = [],
  placeholder = "Type a task and press Enter... Use @ to assign",
  onTaskCreated,
  onCustomerChange,
  onSiteChange,
  showAiExpand = true,
  autoFocus = false,
}: InlineTaskInputProps) {
  const [isActive, setIsActive] = useState(autoFocus);
  const [value, setValue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recentlyCreated, setRecentlyCreated] = useState<string | null>(null);

  // @ mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-focus on mount when autoFocus is true
  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [autoFocus]);

  const selectedUser = assignableUsers.find((u) => u.id === assigneeId);
  const selectedSites = assignableSites.filter((s) => selectedSiteIds.includes(s.id) && s.id !== siteId);
  const selectedCustomer = assignableCustomers.find((c) => c.id === selectedCustomerId);

  // Has any mentionable items?
  const hasMentionables = assignableUsers.length > 0 || assignableSites.length > 0 || assignableCustomers.length > 0;

  // Filter mentionables by query
  const filteredResults = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const people = assignableUsers.filter((u) =>
      u.full_name.toLowerCase().includes(q),
    );
    const sites = assignableSites.filter((s) =>
      s.name.toLowerCase().includes(q) && !selectedSiteIds.includes(s.id) && s.id !== siteId,
    );
    const companies = assignableCustomers.filter((c) =>
      c.name.toLowerCase().includes(q),
    );
    return { people, sites, companies };
  }, [mentionQuery, assignableUsers, assignableSites, assignableCustomers, selectedSiteIds, siteId]);

  const flatResults = useMemo(() => {
    const items: Array<
      | { type: "person"; data: AssignableUser }
      | { type: "site"; data: AssignableSite }
      | { type: "company"; data: AssignableCustomer }
    > = [];
    for (const c of filteredResults.companies) items.push({ type: "company", data: c });
    for (const p of filteredResults.people) items.push({ type: "person", data: p });
    for (const s of filteredResults.sites) items.push({ type: "site", data: s });
    return items;
  }, [filteredResults]);

  // Clamp selection index
  useEffect(() => {
    if (mentionSelectedIdx >= flatResults.length) {
      setMentionSelectedIdx(Math.max(0, flatResults.length - 1));
    }
  }, [flatResults.length, mentionSelectedIdx]);

  // Close mention on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setMentionActive(false);
      }
    }
    if (mentionActive) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mentionActive]);

  // Strip the @query text from value and apply the selection
  const applyMention = useCallback(
    (item: (typeof flatResults)[number]) => {
      // Remove the @query text from the input value
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + mentionQuery.length + 1); // +1 for the @ char
      const newValue = (before + after).replace(/\s+/g, " ").trim();
      setValue(newValue);

      if (item.type === "person") {
        setAssigneeId(item.data.id);
      } else if (item.type === "site") {
        setSelectedSiteIds((prev) =>
          prev.includes(item.data.id) ? prev : [...prev, item.data.id],
        );
        onSiteChange?.(item.data.id);
      } else if (item.type === "company") {
        setSelectedCustomerId(item.data.id);
        onCustomerChange?.(item.data as AssignableCustomer);
      }

      setMentionActive(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
      setMentionSelectedIdx(0);

      // Re-focus the input
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [value, mentionStartIndex, mentionQuery, onSiteChange, onCustomerChange],
  );

  const handleCreate = useCallback(
    (title: string) => {
      if (!title.trim()) return;

      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("tenantId", tenantId);
      if (milestoneId) formData.set("milestoneId", milestoneId);
      // Use selected values if set, otherwise fall back to props
      // First selected site (or prop) becomes the primary siteId
      const allSiteIds = selectedSiteIds.length > 0 ? selectedSiteIds : (siteId ? [siteId] : []);
      if (allSiteIds[0]) formData.set("siteId", allSiteIds[0]);
      // Additional sites go as comma-separated list
      if (allSiteIds.length > 1) {
        formData.set("additionalSiteIds", allSiteIds.slice(1).join(","));
      }
      const effectiveCustomerId = selectedCustomerId || customerId;
      if (effectiveCustomerId) formData.set("customerId", effectiveCustomerId);
      if (assigneeId) formData.set("assigneeId", assigneeId);

      startTransition(async () => {
        const result = await createTaskInline(formData);
        if ("error" in result) {
          console.error(result.error);
        } else {
          setRecentlyCreated(title.trim());
          setValue("");
          setAssigneeId(null);
          setSelectedSiteIds([]);
          setSelectedCustomerId(null);
          setTimeout(() => setRecentlyCreated(null), 2000);
          onTaskCreated?.();
          router.refresh();
        }
      });
    },
    [tenantId, milestoneId, siteId, selectedSiteIds, selectedCustomerId, customerId, assigneeId, onTaskCreated, router],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    setValue(newValue);

    if (!hasMentionables) return;

    // Detect if user just typed @ or is continuing a mention query
    // Look backwards from cursor to find the @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      // Check there's a space or start-of-string before the @
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (charBefore === " " || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        // No spaces allowed inside mention query
        if (!query.includes(" ")) {
          setMentionActive(true);
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setMentionSelectedIdx(0);
          return;
        }
      }
    }

    // If we get here, close the mention popup
    if (mentionActive) {
      setMentionActive(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // When mention popup is active, intercept navigation keys
    if (mentionActive && flatResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSelectedIdx((prev) => Math.min(prev + 1, flatResults.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSelectedIdx((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = flatResults[mentionSelectedIdx];
        if (item) applyMention(item);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionActive(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreate(value);
    }
    if (e.key === "Escape") {
      setValue("");
      setAssigneeId(null);
      setSelectedSiteIds([]);
      setSelectedCustomerId(null);
      setIsActive(false);
      inputRef.current?.blur();
    }
  };

  const hasChips = !!selectedUser || selectedSites.length > 0 || !!selectedCustomer;

  return (
    <div className="space-y-1">
      {/* Success flash */}
      {recentlyCreated && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-700 bg-green-50 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Created: {recentlyCreated}
        </div>
      )}

      {/* Input row */}
      <div className="relative">
        <div
          className={`group flex items-center gap-2 rounded-lg border transition-all duration-150 ${
            isActive
              ? "border-brand-green/50 bg-white shadow-sm ring-1 ring-brand-green/20"
              : "border-dashed border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-white cursor-text"
          }`}
          onClick={() => {
            setIsActive(true);
            inputRef.current?.focus();
          }}
        >
          <div className="flex items-center justify-center w-8 h-8 ml-1 shrink-0">
            {isPending ? (
              <Loader2 className="h-4 w-4 text-brand-green animate-spin" />
            ) : (
              <Plus className={`h-4 w-4 transition-colors ${isActive ? "text-brand-green" : "text-gray-300 group-hover:text-gray-400"}`} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsActive(true)}
            onBlur={() => {
              if (!value && !assigneeId && selectedSiteIds.length === 0) setIsActive(false);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isActive ? placeholder : "Add a task..."}
            disabled={isPending}
            className="flex-1 bg-transparent py-2.5 pr-1 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
          />

          {isActive && value && (
            <div className="flex items-center gap-1 pr-2 shrink-0">
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                Enter
              </kbd>
            </div>
          )}
        </div>

        {/* @ Mention dropdown */}
        {mentionActive && flatResults.length > 0 && (
          <div
            ref={mentionRef}
            className="absolute left-0 right-0 bottom-full mb-1 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden max-w-xs"
          >
            {/* Companies section */}
            {filteredResults.companies.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  Companies
                </div>
                {filteredResults.companies.map((company) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === "company" && r.data.id === company.id,
                  );
                  return (
                    <button
                      key={`company-${company.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention({ type: "company", data: company });
                      }}
                      onMouseEnter={() => setMentionSelectedIdx(flatIdx)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        flatIdx === mentionSelectedIdx
                          ? "bg-brand-green/10 text-gray-900"
                          : "hover:bg-gray-50 text-gray-700",
                      )}
                    >
                      <div className="h-5 w-5 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                        <Building2 className="h-3 w-3 text-blue-600" />
                      </div>
                      <span className="truncate">{company.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* People section */}
            {filteredResults.people.length > 0 && (
              <>
                <div className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center gap-1.5",
                  filteredResults.companies.length > 0 && "border-t",
                )}>
                  <User className="h-3 w-3" />
                  People
                </div>
                {filteredResults.people.map((user) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === "person" && r.data.id === user.id,
                  );
                  return (
                    <button
                      key={`person-${user.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent blur
                        applyMention({ type: "person", data: user });
                      }}
                      onMouseEnter={() => setMentionSelectedIdx(flatIdx)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        flatIdx === mentionSelectedIdx
                          ? "bg-brand-green/10 text-gray-900"
                          : "hover:bg-gray-50 text-gray-700",
                      )}
                    >
                      <Avatar
                        name={user.full_name}
                        src={user.avatar_url}
                        size="sm"
                        className="h-5 w-5 text-[10px]"
                      />
                      <span className="truncate">{user.full_name}</span>
                      {user.group && (
                        <span className="ml-auto text-[10px] text-gray-400">{user.group}</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Sites section */}
            {filteredResults.sites.length > 0 && (
              <>
                <div className={cn(
                  "px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center gap-1.5",
                  (filteredResults.people.length > 0 || filteredResults.companies.length > 0) && "border-t",
                )}>
                  <MapPin className="h-3 w-3" />
                  Sites
                </div>
                {filteredResults.sites.map((site) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === "site" && r.data.id === site.id,
                  );
                  return (
                    <button
                      key={`site-${site.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMention({ type: "site", data: site });
                      }}
                      onMouseEnter={() => setMentionSelectedIdx(flatIdx)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2",
                        flatIdx === mentionSelectedIdx
                          ? "bg-brand-green/10 text-gray-900"
                          : "hover:bg-gray-50 text-gray-700",
                      )}
                    >
                      <div className="h-5 w-5 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                        <MapPin className="h-3 w-3 text-gray-500" />
                      </div>
                      <span className="truncate">{site.name}</span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Hint at bottom */}
            <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2 text-[10px] text-gray-400">
              <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">
                <span className="text-[9px]">&uarr;&darr;</span>
              </kbd>
              navigate
              <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">
                <span className="text-[9px]">enter</span>
              </kbd>
              select
              <kbd className="rounded border border-gray-200 bg-white px-1 py-0.5 font-mono">
                <span className="text-[9px]">esc</span>
              </kbd>
              dismiss
            </div>
          </div>
        )}

        {/* Empty mention state */}
        {mentionActive && flatResults.length === 0 && mentionQuery.length > 0 && (
          <div
            ref={mentionRef}
            className="absolute left-0 right-0 bottom-full mb-1 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden max-w-xs"
          >
            <div className="px-3 py-4 text-xs text-gray-400 text-center">
              No matches for &ldquo;@{mentionQuery}&rdquo;
            </div>
          </div>
        )}
      </div>

      {/* Selected chips */}
      {isActive && hasChips && (
        <div className="flex items-center gap-1.5 pl-10">
          {selectedCustomer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">
              <Building2 className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{selectedCustomer.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCustomerId(null);
                  onCustomerChange?.(null);
                }}
                className="ml-0.5 hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedUser && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs">
              <Avatar
                name={selectedUser.full_name}
                src={selectedUser.avatar_url}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span className="max-w-[100px] truncate">{selectedUser.full_name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssigneeId(null);
                }}
                className="ml-0.5 hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {selectedSites.map((site) => (
            <span key={site.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs">
              <MapPin className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{site.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSiteIds((prev) => prev.filter((id) => id !== site.id));
                }}
                className="ml-0.5 hover:text-emerald-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hint text when active and has mentionables */}
      {isActive && hasMentionables && !hasChips && !mentionActive && !value && (
        <p className="text-[10px] text-gray-400 pl-10">
          Type <kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono text-[10px]">@</kbd> to assign to a company, person, or site
        </p>
      )}
    </div>
  );
}
