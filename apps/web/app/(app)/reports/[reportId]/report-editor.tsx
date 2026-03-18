"use client";

import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Textarea } from "../../../../components/ui/input";
import { Badge } from "../../../../components/ui/badge";
import {
  Save,
  Sparkles,
  Send,
  Eye,
  Pencil,
  FileText,
  Target,
  ListTodo,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
type ReportStatus = "draft" | "generating" | "review" | "published";

interface StatusReport {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  siteId: string | null;
  siteName: string | null;
  title: string;
  slug: string;
  status: ReportStatus;
  dateRangeStart: string;
  dateRangeEnd: string;
  createdBy: string;
  createdByName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportSection {
  id: string;
  reportId: string;
  sectionType: string;
  title: string;
  content: string;
  sortOrder: number;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  executive_summary: <FileText className="h-4 w-4" />,
  milestone_progress: <Target className="h-4 w-4" />,
  task_summary: <ListTodo className="h-4 w-4" />,
  flagged_issues: <AlertTriangle className="h-4 w-4" />,
  next_steps: <ArrowRight className="h-4 w-4" />,
};

interface ReportEditorProps {
  report: StatusReport;
  sections: ReportSection[];
  customers: { id: string; name: string }[];
}

export function ReportEditor({ report, sections, customers }: ReportEditorProps) {
  const [previewMode, setPreviewMode] = useState(false);
  const [sectionContents, setSectionContents] = useState<Record<string, string>>(
    Object.fromEntries(sections.map((s) => [s.id, s.content])),
  );
  const [saving, setSaving] = useState(false);

  const isPublished = report.status === "published";

  function handleSectionChange(sectionId: string, content: string) {
    setSectionContents((prev) => ({ ...prev, [sectionId]: content }));
  }

  async function handleSaveDraft() {
    setSaving(true);
    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-card px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !previewMode
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              previewMode
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isPublished && (
            <>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </Button>
              <Button size="sm">
                <Send className="h-4 w-4" />
                Publish
              </Button>
            </>
          )}
          {isPublished && (
            <Badge variant="success">Published {report.publishedAt ? new Date(report.publishedAt).toLocaleDateString() : ""}</Badge>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.id}
            className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden"
          >
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <span className="text-gray-400">
                {SECTION_ICONS[section.sectionType] ?? <FileText className="h-4 w-4" />}
              </span>
              <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
            </div>
            <div className="p-6">
              {previewMode || isPublished ? (
                <div className="prose prose-sm max-w-none text-gray-700">
                  {sectionContents[section.id] ? (
                    <p className="whitespace-pre-wrap">{sectionContents[section.id]}</p>
                  ) : (
                    <p className="text-gray-400 italic">No content yet.</p>
                  )}
                </div>
              ) : (
                <Textarea
                  value={sectionContents[section.id] ?? ""}
                  onChange={(e) => handleSectionChange(section.id, e.target.value)}
                  placeholder={`Write the ${section.title.toLowerCase()} for this report...`}
                  rows={6}
                  className="min-h-[120px]"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
