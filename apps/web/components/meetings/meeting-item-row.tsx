"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { X, ExternalLink, User, MapPin } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";

interface MeetingItem {
  id: string;
  type: string;
  body: string;
  author_id: string;
  assignee_id: string | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  task_id: string | null;
  author?: { id: string; full_name: string; avatar_url: string | null };
  assignee?: { id: string; full_name: string; avatar_url: string | null };
}

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface MeetingItemRowProps {
  item: MeetingItem;
  onUpdate: (itemId: string, updates: { body?: string; completed?: boolean; assigneeId?: string | null }) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  isActive: boolean;
  teamMembers?: TeamMember[];
  sites?: { id: string; name: string }[];
}

export function MeetingItemRow({ item, onUpdate, onDelete, isActive, teamMembers = [], sites = [] }: MeetingItemRowProps) {
  const [value, setValue] = useState(item.body);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(item.body);

  // @ mention state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  const isActionItem = item.type === "action_item";
  const hasMentionables = isActionItem && (teamMembers.length > 0 || sites.length > 0);

  // Filter mentionables by query
  const filteredResults = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const people = teamMembers.filter((m) =>
      m.fullName.toLowerCase().includes(q)
    );
    const filteredSites = sites.filter((s) =>
      s.name.toLowerCase().includes(q)
    );
    return { people, sites: filteredSites };
  }, [mentionQuery, teamMembers, sites]);

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
    (selectedItem: (typeof flatResults)[number]) => {
      const before = value.slice(0, mentionStartIndex);
      const after = value.slice(mentionStartIndex + mentionQuery.length + 1); // +1 for @
      const newValue = (before + after).replace(/\s+/g, " ").trim();
      setValue(newValue);

      if (selectedItem.type === "person") {
        // Save assignee immediately
        onUpdate(item.id, { assigneeId: selectedItem.data.id });
      }
      // Site linking on edit could be added later if needed

      setMentionActive(false);
      setMentionQuery("");
      setMentionStartIndex(-1);
      setMentionSelectedIdx(0);

      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [value, mentionStartIndex, mentionQuery, item.id, onUpdate]
  );

  const save = useCallback(async () => {
    if (mentionActive) return; // Don't save while mention dropdown is open
    const trimmed = value.trim();
    if (trimmed === lastSavedRef.current || !trimmed) return;
    setSaving(true);
    await onUpdate(item.id, { body: trimmed });
    lastSavedRef.current = trimmed;
    setSaving(false);
  }, [item.id, value, onUpdate, mentionActive]);

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
        const selectedItem = flatResults[mentionSelectedIdx];
        if (selectedItem) applyMention(selectedItem);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionActive(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const toggleComplete = async () => {
    await onUpdate(item.id, { completed: !item.completed });
  };

  const isCarriedForward = isActionItem && !item.completed && (() => {
    const createdDate = item.created_at?.split("T")[0];
    if (!createdDate) return false;
    const today = new Date().toISOString().split("T")[0];
    return createdDate < today!;
  })();

  return (
    <div className="group flex items-start gap-2 py-1 hover:bg-gray-50/50 -mx-1 px-1 rounded transition-colors">
      {/* Checkbox for action items */}
      {isActionItem && (
        <button
          onClick={toggleComplete}
          disabled={!isActive}
          className={`mt-0.5 shrink-0 w-4 h-4 rounded border transition-colors ${
            item.completed
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          {item.completed && (
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      {/* Bullet for notes */}
      {!isActionItem && (
        <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-gray-300" />
      )}

      {/* Body — inline editable with @ mention support */}
      <div className="flex-1 min-w-0 relative">
        {isActive ? (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={save}
            onKeyDown={handleKeyDown}
            className={`w-full bg-transparent text-xs text-gray-700 border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-green focus:ring-0 focus:outline-none px-0 py-0.5 transition-colors ${
              saving ? "opacity-50" : ""
            } ${item.completed ? "line-through text-gray-400" : ""}`}
          />
        ) : (
          <p className={`text-xs text-gray-700 py-0.5 ${item.completed ? "line-through text-gray-400" : ""}`}>
            {item.body}
          </p>
        )}

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

        {/* Meta: author, assignee, due date, task link */}
        <div className="flex items-center gap-2 mt-0.5">
          {item.author && (
            <span className="text-[10px] text-gray-400">{item.author.full_name}</span>
          )}
          {isActionItem && !item.completed && isCarriedForward && (
            <span className="text-[10px] text-amber-600 bg-amber-50 rounded px-1 py-0.5">carried forward</span>
          )}
          {isActionItem && item.assignee && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
              <Avatar name={item.assignee.full_name} src={item.assignee.avatar_url} size="sm" />
              {item.assignee.full_name}
            </span>
          )}
          {item.due_date && (
            <span className={`text-[10px] ${
              new Date(item.due_date) < new Date() && !item.completed
                ? "text-red-500"
                : "text-gray-400"
            }`}>
              Due {new Date(item.due_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {item.task_id && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-brand-green">
              <ExternalLink className="h-2.5 w-2.5" />
              Task
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      {isActive && (
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
