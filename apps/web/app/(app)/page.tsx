import Link from "next/link";
import { after } from "next/server";
import { getCustomersWithAccountData, getAllFlaggedIssues, getAllOpenTasks } from "../../lib/data/queries";
import type { CustomerListItem } from "../../lib/data/queries";
import { getStandupDealData, getUpcomingMeetingsAllCustomers } from "../../lib/data/meeting-queries";
import type { DashboardMeeting } from "../../lib/data/meeting-queries";
import { getCurrentUser } from "../../lib/data/current-user";
import { triggerCalendarSyncForCurrentUser } from "../../lib/calendar/trigger-sync";
import { StatusBadge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import { DashboardMeetingsClient } from "../../components/dashboard/dashboard-meetings";
import {
  Building2,
  MapPin,
  DollarSign,
  Handshake,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ListTodo,
  Users,
  ExternalLink,
  Clock,
} from "lucide-react";

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

export default async function DashboardPage() {
  let customersData: CustomerListItem[] = [];
  let dealData: Record<string, StandupDeal[]> = {};
  let upcomingMeetings: DashboardMeeting[] = [];
  let openTasks: Awaited<ReturnType<typeof getAllOpenTasks>> = [];
  let openIssues: Awaited<ReturnType<typeof getAllFlaggedIssues>> = [];
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    [customersData, dealData, upcomingMeetings, openTasks, openIssues, currentUser] = await Promise.all([
      getCustomersWithAccountData(),
      getStandupDealData(),
      getUpcomingMeetingsAllCustomers(),
      getAllOpenTasks().then((t) => t.slice(0, 8)),
      getAllFlaggedIssues(),
      getCurrentUser(),
    ]);
  } catch {
    // If Supabase is not connected, show empty state
  }

  after(triggerCalendarSyncForCurrentUser);

  const displayName = currentUser?.full_name?.split(" ")[0] ?? "there";

  // Compute aggregate stats
  const totalCustomers = customersData.length;
  const activeSites = customersData.reduce((s, c) => s + c.active_sites, 0);
  const allDeals = Object.values(dealData).flat();
  const pipelineValue = allDeals.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);
  const openDealCount = allDeals.length;
  const totalAddressable = customersData.reduce((s, c) => s + (c.total_addressable_sites ?? c.total_sites ?? 0), 0);
  const penetration = totalAddressable > 0 ? Math.round((activeSites / totalAddressable) * 100) : 0;
  const totalIssues = openIssues.length;

  // Portfolio whitespace aggregates
  const deployingSites = customersData.reduce((s, c) => s + c.deploying_sites, 0);
  const evalSites = customersData.reduce((s, c) => s + c.eval_sites, 0);
  const prospectSites = customersData.reduce((s, c) => s + (c.total_sites - c.active_sites - c.deploying_sites - c.eval_sites), 0);

  // Customer meeting counts for sorting
  const meetingsByCustomer = new Map<string, number>();
  for (const m of upcomingMeetings) {
    meetingsByCustomer.set(m.customer_id, (meetingsByCustomer.get(m.customer_id) ?? 0) + 1);
  }

  // Sort customers by urgency
  const today = new Date().toISOString().split("T")[0]!;
  const sortedCustomers = [...customersData].sort((a, b) => {
    // Issues first
    if (a.open_issues !== b.open_issues) return b.open_issues - a.open_issues;
    // Then overdue tasks
    const aOverdue = a.open_tasks > 0 ? 1 : 0;
    const bOverdue = b.open_tasks > 0 ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;
    // Then meetings this week
    const aMeetings = meetingsByCustomer.get(a.id) ?? 0;
    const bMeetings = meetingsByCustomer.get(b.id) ?? 0;
    if (aMeetings !== bMeetings) return bMeetings - aMeetings;
    // Alphabetical
    return a.name.localeCompare(b.name);
  });

  // Deal pipeline grouped by type
  const newBizDeals = allDeals.filter((d) => d.dealType === "new_business");
  const renewalDeals = allDeals.filter((d) => d.dealType === "renewal");

  // Customer name lookup for deals
  const customerNameById = new Map(customersData.map((c) => [c.id, c.name]));

  // Enrich deals with customer name
  const dealsWithCustomer = (deals: StandupDeal[], customerId: string, customerName: string) =>
    deals.map((d) => ({ ...d, customerName }));

  const enrichedNewBiz: (StandupDeal & { customerName: string })[] = [];
  const enrichedRenewals: (StandupDeal & { customerName: string })[] = [];
  for (const [custId, deals] of Object.entries(dealData)) {
    const name = customerNameById.get(custId) ?? "Unknown";
    for (const d of deals) {
      if (d.dealType === "new_business") enrichedNewBiz.push({ ...d, customerName: name });
      else enrichedRenewals.push({ ...d, customerName: name });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {displayName}</p>
      </div>

      {/* Zone 1: Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Companies" value={totalCustomers} />
        <StatCard icon={<MapPin className="h-4 w-4" />} label="Active Sites" value={activeSites} />
        <StatCard icon={<DollarSign className="h-4 w-4" />} label="Pipeline" value={pipelineValue} format="currency" />
        <StatCard icon={<Handshake className="h-4 w-4" />} label="Open Deals" value={openDealCount} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Penetration" value={penetration} format="percent" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Open Issues" value={totalIssues} accent={totalIssues > 0} />
      </div>

      {/* Zone 2: Accounts + This Week */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Accounts */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Accounts</h2>
            <Link href="/customers" className="text-[11px] text-brand-green font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {sortedCustomers.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No companies yet</p>
            ) : (
              sortedCustomers.map((c) => (
                <AccountRow
                  key={c.id}
                  customer={c}
                  dealCount={dealData[c.id]?.length ?? 0}
                  dealValue={dealData[c.id]?.reduce((s, d) => s + parseFloat(d.amount || "0"), 0) ?? 0}
                  meetingCount={meetingsByCustomer.get(c.id) ?? 0}
                />
              ))
            )}
          </div>
        </div>

        {/* This Week */}
        <div className="space-y-4">
          {/* Meetings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card">
            <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100">
              <CalendarDays className="h-3.5 w-3.5 text-purple-500" />
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Meetings</h2>
            </div>
            <div className="px-4 py-3">
              {upcomingMeetings.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No upcoming meetings</p>
              ) : (
                <DashboardMeetingsClient meetings={upcomingMeetings} />
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Tasks</h2>
              </div>
              <Link href="/tasks" className="text-[11px] text-brand-green font-medium hover:underline">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {openTasks.length === 0 ? (
                <p className="px-5 py-6 text-xs text-gray-400 text-center">No open tasks</p>
              ) : (
                openTasks.map((task) => {
                  const isOverdue = task.due_date && task.due_date < today;
                  return (
                    <div key={task.id} className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={task.status} />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-900 truncate">{task.title}</p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {(task as any).milestone?.site?.customer?.name || (task as any).direct_customer?.name || ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.assignee?.full_name && <Avatar name={task.assignee.full_name} size="sm" />}
                        {task.due_date && (
                          <span className={`text-[10px] tabular-nums ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                            {task.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zone 3: Portfolio Whitespace Bar */}
      {totalAddressable > 0 && (
        <PortfolioWhitespaceBar
          active={activeSites}
          deploying={deployingSites}
          evaluating={evalSites}
          prospect={prospectSites > 0 ? prospectSites : 0}
          total={totalAddressable}
          penetration={penetration}
        />
      )}

      {/* Zone 4: Deal Pipeline */}
      {allDeals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100">
            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Deal Pipeline</h2>
            <span className="text-[10px] text-gray-400 ml-1">({allDeals.length} open)</span>
          </div>
          <div className="overflow-x-auto">
            {enrichedNewBiz.length > 0 && (
              <DealSection label="New Business" deals={enrichedNewBiz} />
            )}
            {enrichedRenewals.length > 0 && (
              <DealSection label="Renewals" deals={enrichedRenewals} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Sub-Components ─────────────────────────────

function StatCard({
  icon,
  label,
  value,
  format,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  format?: "currency" | "percent";
  accent?: boolean;
}) {
  let display: string;
  if (format === "currency") {
    if (value >= 1_000_000) display = `$${(value / 1_000_000).toFixed(1)}M`;
    else if (value >= 1_000) display = `$${Math.round(value / 1_000)}k`;
    else display = `$${value}`;
  } else if (format === "percent") {
    display = `${value}%`;
  } else {
    display = value.toString();
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-card">
      <div className={`mb-1.5 ${accent ? "text-error" : "text-gray-400"}`}>{icon}</div>
      <p className={`text-xl font-bold ${accent ? "text-error" : "text-gray-900"}`}>{display}</p>
      <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

const STAGE_STYLES: Record<string, string> = {
  prospect: "bg-gray-100 text-gray-600",
  pilot: "bg-blue-50 text-blue-600",
  expansion: "bg-amber-50 text-amber-600",
  mature: "bg-green-50 text-green-600",
  strategic: "bg-purple-50 text-purple-600",
};

function AccountRow({
  customer: c,
  dealCount,
  dealValue,
  meetingCount,
}: {
  customer: CustomerListItem;
  dealCount: number;
  dealValue: number;
  meetingCount: number;
}) {
  const addressable = c.total_addressable_sites ?? c.total_sites ?? 0;
  const penetration = addressable > 0 ? Math.round((c.active_sites / addressable) * 100) : 0;
  const barWidth = addressable > 0 ? Math.min((c.active_sites / addressable) * 100, 100) : 0;

  return (
    <Link
      href={`/customers/${c.slug}`}
      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors group"
    >
      {/* Icon */}
      <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4 text-gray-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{c.name}</span>
          {c.account_stage && (
            <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded-full ${STAGE_STYLES[c.account_stage] ?? STAGE_STYLES.prospect}`}>
              {c.account_stage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {/* Penetration mini-bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-green"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {c.active_sites}/{addressable} ({penetration}%)
            </span>
          </div>

          {/* Deal info */}
          {dealCount > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <DollarSign className="h-2.5 w-2.5" />
              {dealCount} deal{dealCount !== 1 ? "s" : ""}
              {dealValue > 0 && ` ($${dealValue >= 1000 ? Math.round(dealValue / 1000) + "k" : dealValue})`}
            </span>
          )}

          {/* Meeting count */}
          {meetingCount > 0 && (
            <span className="text-[10px] text-purple-500 flex items-center gap-0.5">
              <CalendarDays className="h-2.5 w-2.5" />
              {meetingCount} mtg{meetingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Right: urgency indicators */}
      <div className="flex items-center gap-2 shrink-0">
        {c.open_issues > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {c.open_issues}
          </span>
        )}
        {c.open_tasks > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <ListTodo className="h-3 w-3" />
            {c.open_tasks}
          </span>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-gray-200 group-hover:text-gray-400 transition-colors" />
      </div>
    </Link>
  );
}


function PortfolioWhitespaceBar({
  active,
  deploying,
  evaluating,
  prospect,
  total,
  penetration,
}: {
  active: number;
  deploying: number;
  evaluating: number;
  prospect: number;
  total: number;
  penetration: number;
}) {
  const pct = (n: number) => Math.max((n / total) * 100, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-brand-green" />
          Portfolio Whitespace
        </h3>
        <span className="text-xs text-gray-500">
          <span className="font-bold text-gray-900">{active}</span> active / {total} addressable
          <span className="ml-1.5 font-bold text-brand-green">{penetration}%</span>
        </span>
      </div>
      {/* Bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {active > 0 && (
          <div className="h-full bg-brand-green" style={{ width: `${pct(active)}%` }} title={`${active} active`} />
        )}
        {deploying > 0 && (
          <div className="h-full bg-blue-400" style={{ width: `${pct(deploying)}%` }} title={`${deploying} deploying`} />
        )}
        {evaluating > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${pct(evaluating)}%` }} title={`${evaluating} evaluating`} />
        )}
        {prospect > 0 && (
          <div className="h-full bg-gray-300" style={{ width: `${pct(prospect)}%` }} title={`${prospect} prospect`} />
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <LegendItem color="bg-brand-green" label="Active" count={active} />
        <LegendItem color="bg-blue-400" label="Deploying" count={deploying} />
        <LegendItem color="bg-amber-400" label="Evaluating" count={evaluating} />
        <LegendItem color="bg-gray-300" label="Prospect" count={prospect} />
        <LegendItem color="bg-gray-100" label="Untapped" count={Math.max(total - active - deploying - evaluating - prospect, 0)} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-gray-500">
        {label} <span className="font-medium text-gray-700">{count}</span>
      </span>
    </div>
  );
}

function formatCurrency(value: string | null): string {
  if (!value) return "\u2014";
  const num = parseFloat(value);
  if (isNaN(num)) return "\u2014";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num / 1_000)}k`;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDealDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const FORECAST_COLORS: Record<string, string> = {
  commit: "text-green-600",
  most_likely: "text-blue-600",
  pipeline: "text-gray-500",
  best_case: "text-purple-600",
  omit: "text-gray-400",
};

function DealSection({
  label,
  deals,
}: {
  label: string;
  deals: (StandupDeal & { customerName: string })[];
}) {
  const totalValue = deals.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);

  return (
    <div>
      <div className="px-5 py-2 bg-gray-50/50 border-y border-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {label}
          <span className="font-normal ml-1">({deals.length})</span>
        </span>
        <span className="text-[10px] font-medium text-gray-500">
          {formatCurrency(totalValue.toString())}
        </span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-gray-400 font-medium border-b border-gray-50">
            <th className="py-1.5 px-5 font-medium">Customer</th>
            <th className="py-1.5 px-2 font-medium">Site</th>
            <th className="py-1.5 px-2 font-medium">Stage</th>
            <th className="py-1.5 px-2 font-medium text-right">Amount</th>
            <th className="py-1.5 px-2 font-medium text-right">ARR</th>
            <th className="py-1.5 px-2 font-medium">Forecast</th>
            <th className="py-1.5 px-2 font-medium">Close</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const isClosingSoon = d.closeDate && new Date(d.closeDate) <= new Date(Date.now() + 30 * 86400000);
            return (
              <tr key={d.dealId} className="border-t border-gray-50 hover:bg-gray-50/50">
                <td className="py-1.5 px-5 text-gray-700 font-medium truncate max-w-[120px]">{d.customerName}</td>
                <td className="py-1.5 px-2 text-gray-500 truncate max-w-[120px]">{d.siteName}</td>
                <td className="py-1.5 px-2 text-gray-500 truncate max-w-[100px]">{d.stage}</td>
                <td className="py-1.5 px-2 text-right text-gray-700 font-medium tabular-nums">{formatCurrency(d.amount)}</td>
                <td className="py-1.5 px-2 text-right text-gray-600 tabular-nums">{formatCurrency(d.arr)}</td>
                <td className={`py-1.5 px-2 ${FORECAST_COLORS[d.forecastCategory ?? ""] ?? "text-gray-500"}`}>
                  {d.forecastCategory?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "\u2014"}
                </td>
                <td className={`py-1.5 px-2 tabular-nums ${isClosingSoon ? "text-amber-600 font-medium" : "text-gray-500"}`}>
                  {formatDealDate(d.closeDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
