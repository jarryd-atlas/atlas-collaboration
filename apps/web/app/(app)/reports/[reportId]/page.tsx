import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportById, getReportSections, getCustomers } from "../../../../lib/data/queries";
import { Badge } from "../../../../components/ui/badge";
import { ReportEditor } from "./report-editor";
import { ChevronRight } from "lucide-react";

type ReportStatus = "draft" | "generating" | "review" | "published";

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const variants: Record<ReportStatus, { variant: "default" | "success" | "warning" | "info"; label: string }> = {
    draft: { variant: "default", label: "Draft" },
    generating: { variant: "info", label: "Generating" },
    review: { variant: "warning", label: "In Review" },
    published: { variant: "success", label: "Published" },
  };
  const config = variants[status] ?? variants.draft;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

interface ReportDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = await params;

  let report: Awaited<ReturnType<typeof getReportById>> = null;
  try {
    report = await getReportById(reportId);
  } catch {
    notFound();
  }

  if (!report) {
    notFound();
  }

  let sections: Awaited<ReturnType<typeof getReportSections>> = [];
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];

  try {
    [sections, customers] = await Promise.all([
      getReportSections(reportId),
      getCustomers(),
    ]);
  } catch {
    // Show empty state
  }

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
      ? sections.map((s) => ({
          id: s.id,
          reportId: s.report_id,
          sectionType: s.section_key,
          title: s.title,
          content: s.content,
          sortOrder: s.sort_order,
        }))
      : defaultSectionTypes.map((s, i) => ({
          id: `new-${s.type}`,
          reportId: report.id,
          sectionType: s.type,
          title: s.title,
          content: "",
          sortOrder: i,
        }));

  // Map report to the shape the editor expects
  const reportForEditor = {
    id: report.id,
    tenantId: report.tenant_id,
    customerId: report.customer_id,
    customerName: report.customer?.name ?? "",
    siteId: report.site_id,
    siteName: report.site?.name ?? null,
    title: report.title,
    slug: report.slug,
    status: report.status as ReportStatus,
    dateRangeStart: report.date_from ?? "",
    dateRangeEnd: report.date_to ?? "",
    createdBy: report.created_by,
    createdByName: report.created_by_profile?.full_name ?? "",
    publishedAt: report.published_at,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };

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
            <ReportStatusBadge status={report.status as ReportStatus} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{report.customer?.name ?? ""}</span>
            {report.site?.name && (
              <>
                <span className="text-gray-300">|</span>
                <span>{report.site.name}</span>
              </>
            )}
            <span className="text-gray-300">|</span>
            <span>
              {report.date_from} &mdash; {report.date_to}
            </span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <ReportEditor
        report={reportForEditor}
        sections={displaySections}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
