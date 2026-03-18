import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportById, getReportSections, getCustomers } from "../../../../lib/mock-data";
import { Badge } from "../../../../components/ui/badge";
import { ReportEditor } from "./report-editor";
import { ChevronRight } from "lucide-react";
import type { ReportStatus } from "../../../../lib/mock-data";

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

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = await params;
  const report = getReportById(reportId);

  if (!report) {
    notFound();
  }

  const sections = getReportSections(reportId);
  const customers = getCustomers();

  // Build default sections if none exist (for drafts)
  const defaultSectionTypes = [
    { type: "executive_summary" as const, title: "Executive Summary" },
    { type: "milestone_progress" as const, title: "Milestone Progress" },
    { type: "task_summary" as const, title: "Task Summary" },
    { type: "flagged_issues" as const, title: "Flagged Issues" },
    { type: "next_steps" as const, title: "Next Steps" },
  ];

  const displaySections =
    sections.length > 0
      ? sections
      : defaultSectionTypes.map((s, i) => ({
          id: `new-${s.type}`,
          reportId: report.id,
          sectionType: s.type,
          title: s.title,
          content: "",
          sortOrder: i,
        }));

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center text-sm text-gray-400">
        <Link href="/reports" className="hover:text-gray-600 transition-colors">
          Reports
        </Link>
        <ChevronRight className="h-4 w-4 mx-1" />
        <span className="text-gray-900 font-medium truncate">{report.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
            <ReportStatusBadge status={report.status} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{report.customerName}</span>
            {report.siteName && (
              <>
                <span className="text-gray-300">|</span>
                <span>{report.siteName}</span>
              </>
            )}
            <span className="text-gray-300">|</span>
            <span>
              {report.dateRangeStart} — {report.dateRangeEnd}
            </span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <ReportEditor
        report={report}
        sections={displaySections}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
