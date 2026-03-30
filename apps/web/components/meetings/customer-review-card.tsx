"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, AlertTriangle, FileText, ListTodo, Milestone as MilestoneIcon, MapPin, ExternalLink, CheckCircle2, DollarSign } from "lucide-react";
import { ProgressBar } from "../ui/progress-bar";
import { MeetingItemRow } from "./meeting-item-row";
import { AddItemInput } from "./add-item-input";
import { TaskRow } from "./task-row";
import { Avatar } from "../ui/avatar";

interface MeetingItem {
  id: string;
  type: string;
  body: string;
  customer_id: string | null;
  author_id: string;
  assignee_id: string | null;
  due_date: string | null;
  completed: boolean;
  task_id: string | null;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url: string | null };
  assignee?: { id: string; full_name: string; avatar_url: string | null };
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
  dealType: string;
  stage: string;
  amount: string | null;
  arr: string | null;
  install: string | null;
  upgrade: string | null;
  forecastCategory: string | null;
  closeDate: string | null;
}

interface CustomerReviewCardProps {
  customer: CustomerData;
  items: MeetingItem[];
  deals?: StandupDeal[];
  onAddItem: (
    type: "note" | "action_item",
    body: string,
    customerId?: string | null,
    assigneeId?: string | null,
    dueDate?: string | null,
    siteId?: string | null
  ) => Promise<void>;
  onUpdateItem: (itemId: string, updates: { body?: string; completed?: boolean; assigneeId?: string | null }) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  teamMembers: TeamMember[];
  isActive: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  evaluation: "Evaluation",
  qualified: "Qualified",
  contracted: "Contracted",
  deployment: "Deploying",
  active: "Active",
  paused: "Paused",
  disqualified: "DQ'd",
};

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-600",
  evaluation: "bg-blue-50 text-blue-600",
  qualified: "bg-purple-50 text-purple-600",
  contracted: "bg-indigo-50 text-indigo-600",
  deployment: "bg-amber-50 text-amber-600",
  active: "bg-green-50 text-green-600",
  paused: "bg-orange-50 text-orange-600",
  disqualified: "bg-red-50 text-red-600",
};

export function CustomerReviewCard({
  customer,
  items,
  deals = [],
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  teamMembers,
  isActive,
}: CustomerReviewCardProps) {
  const [expanded, setExpanded] = useState(true);

  const notes = items.filter((i) => i.type === "note");
  const actionItems = items.filter((i) => i.type === "action_item");
  const hasContent = notes.length > 0 || actionItems.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
      {/* Header with customer name + expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3 group">
          <h3 className="text-sm font-bold text-gray-900">{customer.name}</h3>
          <Link href={`/customers/${customer.slug}`} onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3.5 w-3.5 text-gray-400 hover:text-brand-green transition-colors" />
          </Link>
          {/* Quick stat badges */}
          <div className="flex items-center gap-1.5">
            {Object.entries(customer.sites.stages).map(([stage, count]) => (
              <span
                key={stage}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {count} {STAGE_LABELS[stage] ?? stage}
              </span>
            ))}
          </div>
          {customer.issues.open > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-500">
              <AlertTriangle className="h-3 w-3" />
              {customer.issues.open}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? "" : "-rotate-90"}`}
        />
      </button>

      {expanded && (
        <>
          {/* Operational data summary */}
          <div className="px-5 py-3 bg-gray-50/50 border-y border-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Tasks */}
              <div className="flex items-center gap-2">
                <ListTodo className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{customer.tasks.open} open tasks</p>
                  <p className="text-[10px] text-gray-400">
                    {customer.tasks.dueThisWeek > 0 && (
                      <span className="text-amber-500">{customer.tasks.dueThisWeek} due this week</span>
                    )}
                    {customer.tasks.overdue > 0 && (
                      <span className="text-red-500 ml-1">{customer.tasks.overdue} overdue</span>
                    )}
                    {customer.tasks.dueThisWeek === 0 && customer.tasks.overdue === 0 && "None due soon"}
                  </p>
                </div>
              </div>

              {/* Milestones */}
              <div className="flex items-center gap-2">
                <MilestoneIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{customer.milestones.active} active</p>
                  {customer.milestones.items.slice(0, 2).map((m, i) => (
                    <div key={i} className="flex items-center gap-1 mt-0.5">
                      <ProgressBar value={m.progress} size="sm" className="w-12" />
                      <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{customer.documents.count} docs</p>
                </div>
              </div>

              {/* Next Steps */}
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <div>
                  {customer.nextSteps.length > 0 ? (
                    customer.nextSteps.slice(0, 2).map((ns, i) => (
                      <p key={i} className="text-[10px] text-gray-500 truncate max-w-[150px]">
                        <span className="text-gray-400">{ns.siteName}:</span> {ns.nextStep}
                      </p>
                    ))
                  ) : (
                    <p className="text-[10px] text-gray-400">No next steps set</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deals table */}
          {deals.length > 0 && (
            <DealsTable deals={deals} />
          )}

          {/* Meeting notes & action items */}
          <div className="px-5 py-3 space-y-2">
            {/* Notes */}
            {notes.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                {notes.map((item) => (
                  <MeetingItemRow
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                    isActive={isActive}
                  />
                ))}
              </div>
            )}
            {isActive && (
              <AddItemInput
                type="note"
                placeholder="Add note..."
                onAdd={(body) => onAddItem("note", body, customer.id)}
              />
            )}

            {/* Action items */}
            {actionItems.length > 0 && (
              <div className="pt-1.5 border-t border-gray-50">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Action Items</p>
                {actionItems.map((item) => (
                  <MeetingItemRow
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                    isActive={isActive}
                    teamMembers={teamMembers}
                    sites={customer.sitesList}
                  />
                ))}
              </div>
            )}
            {isActive && (
              <AddItemInput
                type="action_item"
                placeholder="Add action item..."
                onAdd={(body, assigneeId, dueDate, siteId) =>
                  onAddItem("action_item", body, customer.id, assigneeId, dueDate, siteId)
                }
                teamMembers={teamMembers}
                sites={customer.sitesList}
              />
            )}

            {/* Open Tasks — collapsible */}
            {customer.tasksList.length > 0 && (
              <TasksAccordion tasks={customer.tasksList} customerSlug={customer.slug} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Deals Table ──────────────────────────────────────

function formatCurrency(value: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}k`;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDealDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

const FORECAST_COLORS: Record<string, string> = {
  commit: "text-green-600",
  most_likely: "text-blue-600",
  pipeline: "text-gray-500",
  best_case: "text-purple-600",
  omit: "text-gray-400",
};

function formatForecast(category: string | null): string {
  if (!category) return "—";
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type QuarterBucket = "past_due" | "this_qtr" | "next_qtr" | "2_qtrs_out" | "everything_else";

const BUCKET_ORDER: QuarterBucket[] = ["past_due", "this_qtr", "next_qtr", "2_qtrs_out", "everything_else"];

function getQuarterBucket(closeDate: string | null): QuarterBucket {
  if (!closeDate) return "everything_else";
  const close = new Date(closeDate);
  const now = new Date();
  if (close < now) return "past_due";
  const closeQ = Math.floor(close.getMonth() / 3);
  const closeY = close.getFullYear();
  const nowQ = Math.floor(now.getMonth() / 3);
  const nowY = now.getFullYear();
  const qtrDiff = (closeY - nowY) * 4 + (closeQ - nowQ);
  if (qtrDiff === 0) return "this_qtr";
  if (qtrDiff === 1) return "next_qtr";
  if (qtrDiff === 2) return "2_qtrs_out";
  return "everything_else";
}

function getQuarterLabel(bucket: QuarterBucket): string {
  const now = new Date();
  const nowQ = Math.floor(now.getMonth() / 3);
  const nowY = now.getFullYear();
  const fmtQtr = (q: number, y: number) => `Q${q + 1} ${y}`;
  const addQtrs = (offset: number) => {
    const totalQ = nowQ + offset;
    return fmtQtr(((totalQ % 4) + 4) % 4, nowY + Math.floor(totalQ / 4));
  };
  switch (bucket) {
    case "past_due": return "Past Due";
    case "this_qtr": return `This Qtr (${addQtrs(0)})`;
    case "next_qtr": return `Next Qtr (${addQtrs(1)})`;
    case "2_qtrs_out": return `2 Qtrs Out (${addQtrs(2)})`;
    case "everything_else": return "Everything Else";
  }
}

const BUCKET_HEADER_COLORS: Record<QuarterBucket, string> = {
  past_due: "text-red-700 bg-red-50 border-b border-red-100",
  this_qtr: "text-gray-900 bg-gray-100 border-b border-gray-200",
  next_qtr: "text-gray-700 bg-gray-50 border-b border-gray-100",
  "2_qtrs_out": "text-gray-600 bg-gray-50/70 border-b border-gray-100",
  everything_else: "text-gray-500 bg-gray-50/50 border-b border-gray-100",
};

const COL_COUNT = 10;

function DealsTable({ deals }: { deals: StandupDeal[] }) {
  const [open, setOpen] = useState(true);

  // Group deals by quarter bucket
  const grouped = new Map<QuarterBucket, StandupDeal[]>();
  for (const deal of deals) {
    const bucket = getQuarterBucket(deal.closeDate);
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket)!.push(deal);
  }

  return (
    <div className="px-5 py-2 border-b border-gray-50">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors w-full mb-1"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <DollarSign className="h-3 w-3" />
        <span>{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>
      </button>

      {open && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-gray-400 font-medium">
                <th className="py-1 px-1 font-medium">Site</th>
                <th className="py-1 px-1 font-medium">Type</th>
                <th className="py-1 px-1 font-medium">Stage</th>
                <th className="py-1 px-1 font-medium text-right">Amount</th>
                <th className="py-1 px-1 font-medium text-right">ARR</th>
                <th className="py-1 px-1 font-medium text-right">Install</th>
                <th className="py-1 px-1 font-medium text-right">Upgrade</th>
                <th className="py-1 px-1 font-medium">Forecast</th>
                <th className="py-1 px-1 font-medium">Close</th>
              </tr>
            </thead>
            <tbody>
              {BUCKET_ORDER.filter((b) => grouped.has(b)).map((bucket) => (
                <DealBucketSection key={bucket} bucket={bucket} deals={grouped.get(bucket)!} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DealBucketSection({ bucket, deals }: { bucket: QuarterBucket; deals: StandupDeal[] }) {
  return (
    <>
      <tr>
        <td colSpan={COL_COUNT} className={`py-1.5 px-2 text-[11px] font-bold uppercase tracking-wider ${BUCKET_HEADER_COLORS[bucket]}`}>
          {getQuarterLabel(bucket)}
          <span className="ml-1.5 font-normal opacity-60">({deals.length})</span>
        </td>
      </tr>
      {deals.map((deal) => (
        <tr key={deal.dealId} className="border-t border-gray-50 hover:bg-gray-50/50">
          <td className="py-1 px-1 text-gray-700 truncate max-w-[120px]">{deal.siteName}</td>
          <td className="py-1 px-1">
            <DealTypeBadge type={deal.dealType} />
          </td>
          <td className="py-1 px-1 text-gray-500 truncate max-w-[100px]">{deal.stage}</td>
          <td className="py-1 px-1 text-right text-gray-700 font-medium tabular-nums">{formatCurrency(deal.amount)}</td>
          <td className="py-1 px-1 text-right text-gray-600 tabular-nums">{formatCurrency(deal.arr)}</td>
          <td className="py-1 px-1 text-right text-gray-600 tabular-nums">{formatCurrency(deal.install)}</td>
          <td className="py-1 px-1 text-right text-gray-600 tabular-nums">{formatCurrency(deal.upgrade)}</td>
          <td className={`py-1 px-1 ${FORECAST_COLORS[deal.forecastCategory ?? ""] ?? "text-gray-500"}`}>
            {formatForecast(deal.forecastCategory)}
          </td>
          <td className="py-1 px-1 text-gray-500 tabular-nums">{formatDealDate(deal.closeDate)}</td>
        </tr>
      ))}
    </>
  );
}

function DealTypeBadge({ type }: { type: string }) {
  if (type === "renewal") {
    return <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-blue-50 text-blue-600">Renew</span>;
  }
  return <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-green-50 text-green-600">New</span>;
}

// ─── Collapsible Tasks Section ─────────────────────────

interface TaskItem {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  site_id: string | null;
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
  siteName: string | null;
}

function TasksAccordion({ tasks, customerSlug }: { tasks: TaskItem[]; customerSlug: string }) {
  const [open, setOpen] = useState(false);

  const now = new Date().toISOString().split("T")[0]!;
  const overdueCount = tasks.filter((t) => t.due_date && t.due_date < now).length;

  return (
    <div className="pt-2 border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors w-full"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <ListTodo className="h-3 w-3" />
        <span>
          {tasks.length} open task{tasks.length !== 1 ? "s" : ""}
          {overdueCount > 0 && (
            <span className="text-red-400 normal-case ml-1">({overdueCount} overdue)</span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-0.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          <Link
            href={`/customers/${customerSlug}`}
            className="block text-[10px] text-brand-green hover:underline mt-1 ml-5"
          >
            View all tasks →
          </Link>
        </div>
      )}
    </div>
  );
}
