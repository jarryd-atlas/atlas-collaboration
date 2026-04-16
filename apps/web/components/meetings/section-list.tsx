"use client";

/**
 * A reusable "section" for the Account 360 dashboard. Renders a title,
 * existing items (each inline-editable via MeetingItemRow), and an
 * AddItemInput at the bottom to append new items to the section.
 *
 * Each item passed in here is tagged with the section key when created.
 */

import { MeetingItemRow } from "./meeting-item-row";
import { AddItemInput } from "./add-item-input";

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface MeetingItem {
  id: string;
  type: string;
  body: string;
  author_id: string;
  assignee_id: string | null;
  due_date: string | null;
  completed: boolean;
  task_id: string | null;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url: string | null };
  assignee?: { id: string; full_name: string; avatar_url: string | null };
}

interface SectionListProps {
  title: string;
  description?: string;
  section: string;
  itemType: "note" | "action_item";
  items: MeetingItem[];
  placeholder: string;
  teamMembers?: TeamMember[];
  onAdd: (
    section: string,
    itemType: "note" | "action_item",
    body: string,
    assigneeId?: string | null,
    dueDate?: string | null,
  ) => Promise<void>;
  onUpdate: (
    itemId: string,
    updates: { body?: string; completed?: boolean; assigneeId?: string | null },
  ) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  emptyHint?: string;
  className?: string;
  accent?: "default" | "priority" | "blocker" | "ask";
}

const ACCENT_STYLES: Record<NonNullable<SectionListProps["accent"]>, string> = {
  default: "bg-white border-gray-100",
  priority: "bg-white border-gray-100",
  blocker: "bg-amber-50/30 border-amber-100",
  ask: "bg-brand-green/5 border-brand-green/20",
};

export function SectionList({
  title,
  description,
  section,
  itemType,
  items,
  placeholder,
  teamMembers = [],
  onAdd,
  onUpdate,
  onDelete,
  emptyHint,
  className = "",
  accent = "default",
}: SectionListProps) {
  const sorted = [...items].sort((a, b) => {
    // Incomplete items first, then by created_at
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.created_at.localeCompare(b.created_at);
  });

  return (
    <div className={`rounded-xl border shadow-card ${ACCENT_STYLES[accent]} ${className}`}>
      <div className="px-4 py-2.5 border-b border-gray-50">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-4 py-2 space-y-0.5">
        {sorted.length === 0 && emptyHint && (
          <p className="text-[11px] text-gray-300 italic py-1">{emptyHint}</p>
        )}
        {sorted.map((item) => (
          <MeetingItemRow
            key={item.id}
            item={item}
            onUpdate={onUpdate}
            onDelete={onDelete}
            isActive={true}
            teamMembers={teamMembers}
          />
        ))}
        <div className="pt-1">
          <AddItemInput
            type={itemType}
            placeholder={placeholder}
            teamMembers={teamMembers}
            onAdd={async (body, assigneeId, dueDate) => {
              await onAdd(section, itemType, body, assigneeId, dueDate);
            }}
          />
        </div>
      </div>
    </div>
  );
}
