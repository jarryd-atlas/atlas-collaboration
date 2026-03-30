"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Plus, User, MapPin, X, Calendar } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface AddItemInputProps {
  type: "note" | "action_item";
  placeholder: string;
  onAdd: (body: string, assigneeId?: string | null, dueDate?: string | null, siteId?: string | null) => Promise<void>;
  teamMembers?: TeamMember[];
  sites?: { id: string; name: string }[];
}

export function AddItemInput({ type, placeholder, onAdd, teamMembers = [], sites = [] }: AddItemInputProps) {
  const [value, setValue] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [showDate, setShowDate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // @ mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  const isActionItem = type === "action_item";
  const hasMentionables = isActionItem && (teamMembers.length > 0 || sites.length > 0);

  const selectedMember = teamMembers.find((m) => m.id === assigneeId);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  // Filter mentionables by query
  const filteredResults = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const people = teamMembers.filter((m) =>
      m.fullName.toLowerCase().includes(q)
    );
    const filteredSites = sites.filter((s) =>
      s.name.toLowerCase().includes(q) && s.id !== selectedSiteId
    );
    return { people, sites: filteredSites };
  }, [mentionQuery, teamMembers, sites, selectedSiteId]);

  const flatResults = useMemo(() => {
    const items: Array<
      | { type: "person"; data: TeamMember }
      | { type: "site"; data: { id: string; name: string } }
    > = [];
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
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + mentionQuery.length + 1); // +1 for @
      const newValue = (before + after).replace(/\s+/g, " ").trim();
      setValue(newValue);

      if (item.type === "person") {
        setAssigneeId(item.data.id);
      } else if (item.type === "site") {
        setSelectedSiteId(item.data.id);
      }

      setMentionActive(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
      setMentionSelectedIdx(0);

      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [value, mentionStartIndex, mentionQuery]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    setValue(newValue);

    if (!hasMentionables) return;

    // Detect @ trigger
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (charBefore === " " || lastAtIndex === 0) {
        const query = textBeforeCursor.slice(lastAtIndex + 1);
        if (!query.includes(" ")) {
          setMentionActive(true);
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setMentionSelectedIdx(0);
          return;
        }
      }
    }

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
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    await onAdd(value.trim(), assigneeId, dueDate || null, selectedSiteId);
    setValue("");
    setAssigneeId(null);
    setSelectedSiteId(null);
    setDueDate("");
    setShowDate(false);
    setMentionActive(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
    setMentionSelectedIdx(0);
    setSubmitting(false);
    inputRef.current?.focus();
  };

  const hasChips = !!selectedMember || !!selectedSite;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <Plus className="h-3 w-3 text-gray-300 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs text-gray-600 placeholder:text-gray-300 border-0 focus:ring-0 focus:outline-none px-0 py-1"
        />
        {/* Date picker for action items */}
        {isActionItem && value.trim() && (
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowDate(!showDate)}
                className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                  dueDate ? "text-brand-green" : "text-gray-300"
                }`}
                title="Set due date"
              >
                <Calendar className="h-3 w-3" />
              </button>
              {showDate && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg border border-gray-200 shadow-dropdown p-2">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); setShowDate(false); }}
                    className="text-xs border border-gray-200 rounded px-2 py-1"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* @ Mention dropdown */}
      {mentionActive && flatResults.length > 0 && (
        <div
          ref={mentionRef}
          className="absolute left-0 right-0 bottom-full mb-1 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden max-w-xs"
        >
          {/* People section */}
          {filteredResults.people.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                <User className="h-3 w-3" />
                People
              </div>
              {filteredResults.people.map((member) => {
                const flatIdx = flatResults.findIndex(
                  (r) => r.type === "person" && r.data.id === member.id
                );
                return (
                  <button
                    key={`person-${member.id}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMention({ type: "person", data: member });
                    }}
                    onMouseEnter={() => setMentionSelectedIdx(flatIdx)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2",
                      flatIdx === mentionSelectedIdx
                        ? "bg-brand-green/10 text-gray-900"
                        : "hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <Avatar
                      name={member.fullName}
                      src={member.avatarUrl}
                      size="sm"
                      className="h-5 w-5 text-[10px]"
                    />
                    <span className="truncate">{member.fullName}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* Sites section */}
          {filteredResults.sites.length > 0 && (
            <>
              <div className={cn(
                "px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 flex items-center gap-1.5",
                filteredResults.people.length > 0 && "border-t"
              )}>
                <MapPin className="h-3 w-3" />
                Sites
              </div>
              {filteredResults.sites.map((site) => {
                const flatIdx = flatResults.findIndex(
                  (r) => r.type === "site" && r.data.id === site.id
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
                      "w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2",
                      flatIdx === mentionSelectedIdx
                        ? "bg-brand-green/10 text-gray-900"
                        : "hover:bg-gray-50 text-gray-700"
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
        </div>
      )}

      {/* Empty mention state */}
      {mentionActive && flatResults.length === 0 && mentionQuery.length > 0 && (
        <div
          ref={mentionRef}
          className="absolute left-0 right-0 bottom-full mb-1 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden max-w-xs"
        >
          <div className="px-3 py-3 text-xs text-gray-400 text-center">
            No matches for &ldquo;@{mentionQuery}&rdquo;
          </div>
        </div>
      )}

      {/* Selected chips + due date below input */}
      {isActionItem && (hasChips || dueDate) && value.trim() && (
        <div className="flex items-center gap-1.5 ml-4.5 mt-0.5 flex-wrap">
          {selectedMember && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 px-1.5 py-0.5 text-[10px]">
              <User className="h-2.5 w-2.5" />
              <span className="max-w-[80px] truncate">{selectedMember.fullName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssigneeId(null);
                }}
                className="ml-0.5 hover:text-blue-900"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {selectedSite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px]">
              <MapPin className="h-2.5 w-2.5" />
              <span className="max-w-[80px] truncate">{selectedSite.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSiteId(null);
                }}
                className="ml-0.5 hover:text-emerald-900"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {dueDate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px]">
              <Calendar className="h-2.5 w-2.5" />
              {new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDueDate("");
                }}
                className="ml-0.5 hover:text-amber-900"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
