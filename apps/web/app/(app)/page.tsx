import Link from "next/link";
import { getDashboardStats, getCustomers, MOCK_TASKS, MOCK_FLAGGED_ISSUES } from "../../lib/mock-data";
import { StatusBadge, SeverityBadge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import {
  Building2,
  MapPin,
  ListTodo,
  AlertTriangle,
  Target,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const stats = getDashboardStats();
  const customers = getCustomers();
  const openTasks = MOCK_TASKS.filter((t) => t.status !== "done").slice(0, 5);
  const openIssues = MOCK_FLAGGED_ISSUES.filter((i) => i.status === "open");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, Sarah</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Customers" value={stats.totalCustomers} />
        <StatCard icon={<MapPin className="h-5 w-5" />} label="Active Sites" value={stats.activeSites} />
        <StatCard icon={<Target className="h-5 w-5" />} label="Active Milestones" value={stats.activeMilestones} />
        <StatCard icon={<ListTodo className="h-5 w-5" />} label="Open Tasks" value={stats.openTasks} />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Open Issues"
          value={stats.openIssues}
          accent={stats.openIssues > 0}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Customers</h2>
            <Link href="/customers" className="text-sm text-brand-green font-medium hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {customers.map((customer) => (
              <Link
                key={customer.slug}
                href={`/customers/${customer.slug}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                    <p className="text-xs text-gray-400">
                      {customer.activeSites} active / {customer.totalSites} total sites
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>

        {/* Open issues */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Flagged Issues</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {openIssues.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No open issues</p>
            ) : (
              openIssues.map((issue) => (
                <div key={issue.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{issue.summary}</p>
                    <SeverityBadge severity={issue.severity} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{issue.siteName}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Open tasks */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Upcoming Tasks</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {openTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={task.status} />
                <p className="text-sm text-gray-900 truncate">{task.title}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {task.assigneeName && <Avatar name={task.assigneeName} size="sm" />}
                {task.dueDate && (
                  <span className="text-xs text-gray-400">{task.dueDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-card">
      <div className={`mb-2 ${accent ? "text-error" : "text-gray-400"}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
