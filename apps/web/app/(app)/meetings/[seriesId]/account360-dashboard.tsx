"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Sparkles } from "lucide-react";
import { SectionList } from "../../../../components/meetings/section-list";
import { CustomerSnapshotStrip } from "../../../../components/meetings/customer-snapshot-strip";
import { PresenceBar } from "../../../../components/meetings/presence-bar";
import {
  addMeetingItem,
  updateMeetingItem,
  deleteMeetingItem,
  createMeeting,
} from "../../../../lib/actions/meetings";
import { useMeetingRealtime } from "../../../../lib/hooks/use-meeting-realtime";
import type { Account360Snapshot } from "../../../../lib/data/account-360-queries";

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
  section: string | null;
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
}

interface Meeting {
  id: string;
  meeting_date: string;
  status: string;
  items: MeetingItem[];
}

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface Props {
  series: {
    id: string;
    title: string;
    type: string;
    cadence: string | null;
    customer_id: string | null;
    participants: Participant[];
  };
  meetings: Meeting[];
  snapshot: Account360Snapshot;
  currentUserId: string;
  teamMembers: TeamMember[];
}

// Section config grouped by column
const TEAM_COLUMNS: Array<{
  team: "product" | "revenue" | "marketing";
  label: string;
  accent: string;
}> = [
  { team: "product", label: "Product", accent: "text-blue-600" },
  { team: "revenue", label: "Revenue", accent: "text-emerald-600" },
  { team: "marketing", label: "Marketing", accent: "text-fuchsia-600" },
];

const ROWS: Array<{ key: "working" | "risks" | "opps"; label: string; hint: string }> = [
  { key: "working", label: "What's working", hint: "Wins, momentum, traction" },
  { key: "risks", label: "Risks", hint: "Slippage, blockers from this team" },
  { key: "opps", label: "Opportunities", hint: "Upside / moves to make" },
];

const MOMENTUM_COLORS: Record<string, string> = {
  accelerating: "bg-green-100 text-green-700",
  steady: "bg-blue-100 text-blue-700",
  slowing: "bg-amber-100 text-amber-700",
  stalled: "bg-red-100 text-red-700",
};

function formatCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function Account360Dashboard({
  series,
  meetings,
  snapshot,
  currentUserId,
  teamMembers,
}: Props) {
  const router = useRouter();
  const [startingNewWeek, startTransition] = useTransition();
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    meetings[0]?.id ?? null,
  );

  const activeMeeting =
    meetings.find((m) => m.id === selectedMeetingId) ?? meetings[0];
  const activeMeetingId = activeMeeting?.id ?? "";

  const { onlineUserIds } = useMeetingRealtime(
    activeMeetingId,
    currentUserId,
    useCallback(() => {
      router.refresh();
    }, [router]),
  );

  const items = activeMeeting?.items ?? [];
  const itemsBySection = new Map<string, MeetingItem[]>();
  for (const it of items) {
    const key = it.section ?? "_unsectioned";
    const list = itemsBySection.get(key) ?? [];
    list.push(it);
    itemsBySection.set(key, list);
  }

  const handleAdd = async (
    section: string,
    itemType: "note" | "action_item",
    body: string,
    assigneeId?: string | null,
    dueDate?: string | null,
  ) => {
    if (!activeMeetingId) return;
    const result = await addMeetingItem(activeMeetingId, {
      type: itemType,
      body,
      section,
      customerId: series.customer_id ?? null,
      assigneeId,
      dueDate,
    });
    if (!("error" in result)) router.refresh();
  };

  const handleUpdate = async (
    itemId: string,
    updates: { body?: string; completed?: boolean; assigneeId?: string | null },
  ) => {
    const result = await updateMeetingItem(itemId, updates);
    if (!("error" in result)) router.refresh();
  };

  const handleDelete = async (itemId: string) => {
    const result = await deleteMeetingItem(itemId);
    if (!("error" in result)) router.refresh();
  };

  const handleNewWeek = () => {
    startTransition(async () => {
      const result = await createMeeting(series.id);
      if (!("error" in result)) {
        setSelectedMeetingId(result.id);
        router.refresh();
      }
    });
  };

  const momentumLabel = snapshot.momentum
    ? snapshot.momentum.charAt(0).toUpperCase() + snapshot.momentum.slice(1)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/meetings")}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Meetings
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{snapshot.customer.name}</h1>
              <span className="inline-flex items-center rounded-full bg-brand-green/10 text-brand-dark px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                Account 360
              </span>
              {series.cadence && (
                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-medium capitalize">
                  {series.cadence}
                </span>
              )}
              {momentumLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    MOMENTUM_COLORS[snapshot.momentum ?? ""] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {momentumLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {snapshot.deals.length} open deal{snapshot.deals.length !== 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-gray-700">{formatCurrency(snapshot.dealTotalAmount)}</span>{" "}
              in pipeline
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PresenceBar participants={series.participants} onlineUserIds={onlineUserIds} />
            <button
              onClick={handleNewWeek}
              disabled={startingNewWeek}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-dark px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark/90 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {startingNewWeek ? "Starting..." : "New week"}
            </button>
          </div>
        </div>

        {/* Meeting picker */}
        {meetings.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {meetings.map((m) => {
              const active = m.id === activeMeetingId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`text-[11px] rounded-md px-2 py-1 transition-colors ${
                    active
                      ? "bg-brand-dark text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Snapshot strip */}
        <CustomerSnapshotStrip snapshot={snapshot} />

        {/* Cross-team grid (3 cols × 3 rows) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEAM_COLUMNS.map((col) => (
            <div key={col.team} className="space-y-3">
              <h2 className={`text-xs font-bold uppercase tracking-wider ${col.accent}`}>
                {col.label}
              </h2>
              {ROWS.map((row) => {
                const sectionKey = `${col.team}_${row.key}`;
                const sectionItems = itemsBySection.get(sectionKey) ?? [];
                return (
                  <SectionList
                    key={sectionKey}
                    title={row.label}
                    description={row.hint}
                    section={sectionKey}
                    itemType="note"
                    items={sectionItems}
                    placeholder={`Add to ${row.label.toLowerCase()}...`}
                    teamMembers={teamMembers.map((m) => ({
                      id: m.id,
                      fullName: m.fullName,
                      avatarUrl: m.avatarUrl,
                    }))}
                    onAdd={handleAdd}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    emptyHint="—"
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Priorities */}
        <SectionList
          title="Priorities this week"
          description="Top focuses the team is aligning around. Carry forward until complete."
          section="priorities"
          itemType="action_item"
          items={itemsBySection.get("priorities") ?? []}
          placeholder="Add a priority..."
          teamMembers={teamMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            avatarUrl: m.avatarUrl,
          }))}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          emptyHint="No priorities yet — add the top thing the team needs to move this week."
        />

        {/* Blockers */}
        <SectionList
          title="Blockers"
          description="What's in the way and who owns unblocking it."
          section="blockers"
          itemType="action_item"
          items={itemsBySection.get("blockers") ?? []}
          placeholder="Add a blocker..."
          teamMembers={teamMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            avatarUrl: m.avatarUrl,
          }))}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          accent="blocker"
          emptyHint="No blockers surfaced — add one if someone is waiting on something."
        />

        {/* Marketing asks */}
        <SectionList
          title="Marketing asks"
          description="Specific things marketing can do to support this account. Assigning auto-creates a task."
          section="marketing_asks"
          itemType="action_item"
          items={itemsBySection.get("marketing_asks") ?? []}
          placeholder="Add a marketing ask..."
          teamMembers={teamMembers.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            avatarUrl: m.avatarUrl,
          }))}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          accent="ask"
          emptyHint="No asks yet — @assign someone to turn this into a task."
        />
      </div>
    </div>
  );
}
