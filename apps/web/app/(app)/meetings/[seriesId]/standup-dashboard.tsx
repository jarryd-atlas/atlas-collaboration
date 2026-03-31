"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { CustomerReviewCard } from "../../../../components/meetings/customer-review-card";
import { MeetingItemRow } from "../../../../components/meetings/meeting-item-row";
import { AddItemInput } from "../../../../components/meetings/add-item-input";
import { PresenceBar } from "../../../../components/meetings/presence-bar";
import { addMeetingItem, updateMeetingItem, deleteMeetingItem } from "../../../../lib/actions/meetings";
import { useMeetingRealtime } from "../../../../lib/hooks/use-meeting-realtime";

interface Participant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface MeetingItem {
  id: string;
  type: string;
  body: string;
  customer_id: string | null;
  site_id: string | null;
  author_id: string;
  assignee_id: string | null;
  due_date: string | null;
  completed: boolean;
  task_id: string | null;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url: string | null };
  assignee?: { id: string; full_name: string; avatar_url: string | null };
  customer?: { id: string; name: string; slug: string };
}

interface Meeting {
  id: string;
  meeting_date: string;
  status: string;
  items: MeetingItem[];
}

interface CustomerData {
  id: string;
  name: string;
  slug: string;
  sites: { total: number; stages: Record<string, number>; disqualified: number };
  tasks: { open: number; dueThisWeek: number; overdue: number };
  milestones: { active: number; items: { name: string; progress: number }[] };
  issues: { open: number };
  documents: { count: number };
  nextSteps: { siteName: string; nextStep: string }[];
  sitesList: { id: string; name: string }[];
  tasksList: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    site_id: string | null;
    assignee: { id: string; full_name: string; avatar_url: string | null } | null;
    siteName: string | null;
  }[];
}

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface StandupDeal {
  dealId: string;
  siteId: string;
  siteName: string;
  dealName: string;
  dealType: "new_business" | "renewal";
  stage: string;
  amount: string | null;
  arr: string | null;
  install: string | null;
  upgrade: string | null;
  forecastCategory: string | null;
  closeDate: string | null;
}

interface StakeholderInfo {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  stakeholder_role: string | null;
  notes: string | null;
}

interface StandupDashboardProps {
  series: {
    id: string;
    title: string;
    type: string;
    participants: Participant[];
  };
  meetings: Meeting[];
  customerData: CustomerData[];
  dealData: Record<string, StandupDeal[]>;
  weeklyMeetings: Record<string, any[]>;
  stakeholderData: Record<string, StakeholderInfo[]>;
  currentUserId: string;
  teamMembers: TeamMember[];
}

/** Group items by the date they were created, for date separators */
function groupItemsByDate(items: MeetingItem[]): Map<string, MeetingItem[]> {
  const groups = new Map<string, MeetingItem[]>();
  for (const item of items) {
    const date = item.created_at.split("T")[0] ?? "unknown";
    const existing = groups.get(date) ?? [];
    existing.push(item);
    groups.set(date, existing);
  }
  return groups;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function StandupDashboard({
  series,
  meetings: initialMeetings,
  customerData,
  dealData,
  weeklyMeetings,
  stakeholderData,
  currentUserId,
  teamMembers,
}: StandupDashboardProps) {
  const router = useRouter();

  // Use the first (most recent) meeting as the active workspace
  const activeMeeting = initialMeetings[0];

  // Realtime sync
  const { onlineUserIds } = useMeetingRealtime(
    activeMeeting?.id ?? "",
    currentUserId,
    useCallback(() => {
      router.refresh();
    }, [router])
  );

  const handleAddItem = async (
    type: "note" | "action_item",
    body: string,
    customerId?: string | null,
    assigneeId?: string | null,
    dueDate?: string | null,
    siteId?: string | null
  ) => {
    if (!activeMeeting) return;
    const result = await addMeetingItem(activeMeeting.id, {
      type,
      body,
      customerId,
      assigneeId,
      dueDate,
      siteId,
    });
    if (!("error" in result)) {
      router.refresh();
    }
  };

  const handleUpdateItem = async (itemId: string, updates: { body?: string; completed?: boolean; assigneeId?: string | null }) => {
    const result = await updateMeetingItem(itemId, updates);
    if (!("error" in result)) {
      router.refresh();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const result = await deleteMeetingItem(itemId);
    if (!("error" in result)) {
      router.refresh();
    }
  };

  // Collect ALL items across all meetings for the living workspace
  const allItems = initialMeetings.flatMap((m) => m.items);

  // Group items by customer
  const itemsByCustomer = new Map<string, MeetingItem[]>();
  const generalItems: MeetingItem[] = [];
  for (const item of allItems) {
    if (item.customer_id) {
      const existing = itemsByCustomer.get(item.customer_id) ?? [];
      existing.push(item);
      itemsByCustomer.set(item.customer_id, existing);
    } else {
      generalItems.push(item);
    }
  }

  // Group general items by date for date separators
  const generalByDate = groupItemsByDate(generalItems);
  const sortedDates = [...generalByDate.keys()].sort().reverse();

  // Count open action items
  const openActionItems = allItems.filter((i) => i.type === "action_item" && !i.completed).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/meetings")}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Meetings
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{series.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {openActionItems > 0
                ? `${openActionItems} open action item${openActionItems !== 1 ? "s" : ""}`
                : "No open action items"}
            </p>
          </div>
        </div>

        {/* Presence bar */}
        <div className="mt-3">
          <PresenceBar
            participants={series.participants}
            onlineUserIds={onlineUserIds}
          />
        </div>
      </div>

      {/* Always-on workspace */}
      <div className="space-y-4">
        {/* Customer review cards */}
        {customerData.map((customer) => {
          const customerItems = itemsByCustomer.get(customer.id) ?? [];
          return (
            <CustomerReviewCard
              key={customer.id}
              customer={customer}
              items={customerItems}
              deals={dealData[customer.id] ?? []}
              calendarMeetings={weeklyMeetings[customer.id] ?? []}
              stakeholders={stakeholderData[customer.id] ?? []}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              teamMembers={teamMembers}
              isActive={true}
            />
          );
        })}

        {/* General notes & action items section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="px-5 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">General</h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Notes and action items not tied to a specific customer</p>
          </div>
          <div className="px-5 py-3 space-y-2">
            {/* Show items grouped by date with separators */}
            {sortedDates.map((date) => {
              const dateItems = generalByDate.get(date) ?? [];
              return (
                <div key={date}>
                  {/* Date separator */}
                  <div className="flex items-center gap-2 py-1.5">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {formatDateSeparator(date)}
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  {dateItems.map((item) => (
                    <MeetingItemRow
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                      isActive={true}
                      teamMembers={teamMembers}
                    />
                  ))}
                </div>
              );
            })}

            {/* Always-visible inputs */}
            <div className="pt-2 border-t border-gray-50 space-y-1">
              <AddItemInput
                type="note"
                placeholder="Add a note..."
                onAdd={(body) => handleAddItem("note", body)}
              />
              <AddItemInput
                type="action_item"
                placeholder="Add an action item..."
                onAdd={(body, assigneeId, dueDate) =>
                  handleAddItem("action_item", body, null, assigneeId, dueDate)
                }
                teamMembers={teamMembers}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
