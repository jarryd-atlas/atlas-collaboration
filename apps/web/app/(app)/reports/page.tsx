import Link from "next/link";
import { getReports, type ReportStatus } from "../../../lib/mock-data";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { Button } from "../../../components/ui/button";
import { FileText, Plus, Calendar, User } from "lucide-react";
import { ReportFilterTabs } from "./report-filter-tabs";

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const variants: Record<ReportStatus, { variant: "default" | "success" | "warning" | "info"; label: string }> = {
    draft: { variant: "default", label: "Draft" },
    generating: { variant: "info", label: "Generating" },
    review: { variant: "warning", label: "In Review" },
    published: { variant: "success", label: "Published" },
  };
  const { variant, label } = variants[status];
  return <Badge variant={variant}>{label}</Badge>;
}

interface ReportsPageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { filter } = await searchParams;
  const activeFilter = (filter as "all" | "draft" | "published") || "all";
  const reports = getReports(activeFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Status Reports</h1>
          <p className="text-gray-500 mt-1">Create and manage customer status reports</p>
        </div>
        <Link href="/reports/new">
          <Button>
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <ReportFilterTabs activeFilter={activeFilter} />

      {/* Reports list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card">
        {reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No reports yet"
            description={
              activeFilter === "all"
                ? "Create your first status report to get started."
                : `No ${activeFilter} reports found.`
            }
            action={
              <Link href="/reports/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Create Report
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {report.title}
                    </p>
                    <ReportStatusBadge status={report.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-400">{report.customerName}</span>
                    {report.siteName && (
                      <span className="text-xs text-gray-400">{report.siteName}</span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {report.dateRangeStart} — {report.dateRangeEnd}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <User className="h-3 w-3" />
                    {report.createdByName}
                  </span>
                  {report.publishedAt && (
                    <span className="text-xs text-gray-400">
                      Published {new Date(report.publishedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
