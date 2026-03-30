"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PipelineStageBadge, StatusBadge, PriorityBadge } from "../ui/badge";
import { ProgressBar } from "../ui/progress-bar";
import { SiteTasksSection } from "../tasks/site-tasks-section";
import { AddMilestoneButton, ChangeStageButton } from "../forms/site-actions";
import { getSiteOverviewData } from "../../lib/actions/site-overview";
import { X, MapPin, ArrowRight, Calendar, Target, ExternalLink } from "lucide-react";
import type { SitePipelineStage } from "@repo/shared";
import type { AssignableUser } from "../tasks/inline-task-input";

const PIPELINE_STEPS: SitePipelineStage[] = [
  "prospect",
  "evaluation",
  "qualified",
  "contracted",
  "deployment",
  "active",
];

interface Site {
  id?: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  tenant_id: string;
  [key: string]: unknown;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
  latestComment?: { body: string; authorName: string; createdAt: string } | null;
  site?: { id: string; name: string; slug: string } | null;
  milestone?: { id: string; name: string; slug: string } | null;
}

interface SiteOverviewInlineProps {
  site: Site;
  customerSlug: string;
  customerId: string;
  tasks: Task[];
  assignableUsers: AssignableUser[];
  currentUserName: string;
  currentUserAvatar?: string | null;
  onClose: () => void;
}

export function SiteOverviewInline({
  site,
  customerSlug,
  customerId,
  tasks,
  assignableUsers,
  currentUserName,
  currentUserAvatar,
  onClose,
}: SiteOverviewInlineProps) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const siteId = site.id ?? "";
  const siteSlug = site.slug;

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    getSiteOverviewData(siteId)
      .then((data) => setMilestones(data.milestones))
      .catch(() => setMilestones([]))
      .finally(() => setLoading(false));
  }, [siteId]);

  const isDisqualifiedOrPaused =
    site.pipeline_stage === "disqualified" || site.pipeline_stage === "paused";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 truncate">{site.name}</h2>
            <PipelineStageBadge stage={site.pipeline_stage} />
          </div>
          {site.city && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {site.address && `${site.address}, `}{site.city}, {site.state}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={`/customers/${customerSlug}/sites/${siteSlug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-dark hover:text-brand-green transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Full site
          </Link>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Pipeline stage tracker */}
        {!isDisqualifiedOrPaused && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Pipeline</h3>
              <ChangeStageButton siteName={site.name} siteId={siteId} currentStage={site.pipeline_stage as SitePipelineStage} />
            </div>
            <div className="flex items-center gap-1">
              {PIPELINE_STEPS.map((step, i) => {
                const currentIdx = PIPELINE_STEPS.indexOf(site.pipeline_stage as SitePipelineStage);
                const isCompleted = i < currentIdx;
                const isCurrent = i === currentIdx;
                return (
                  <div key={step} className="flex-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        isCompleted
                          ? "bg-brand-green"
                          : isCurrent
                            ? "bg-brand-green/50"
                            : "bg-gray-100"
                      }`}
                    />
                    <p
                      className={`text-[10px] mt-1 ${
                        isCurrent ? "text-gray-900 font-medium" : "text-gray-400"
                      }`}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Milestones {!loading && `(${milestones.length})`}
            </h3>
            <AddMilestoneButton siteName={site.name} siteId={siteId} tenantId={site.tenant_id} />
          </div>

          {loading ? (
            <div className="text-xs text-gray-400 py-2">Loading milestones...</div>
          ) : milestones.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No milestones yet.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
              {milestones.map((milestone: any) => (
                <Link
                  key={milestone.slug}
                  href={`/customers/${customerSlug}/sites/${siteSlug}/milestones/${milestone.slug}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-xs font-medium text-gray-900 truncate">{milestone.name}</h4>
                      <StatusBadge status={milestone.status} />
                      <PriorityBadge priority={milestone.priority} />
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      {milestone.due_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="h-2.5 w-2.5" /> {milestone.due_date}
                        </span>
                      )}
                      <span>
                        {milestone.completed_task_count ?? 0}/{milestone.task_count ?? 0} tasks
                      </span>
                    </div>
                  </div>
                  <div className="w-20 shrink-0">
                    <ProgressBar value={milestone.progress ?? 0} size="sm" showLabel />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Site tasks */}
        <SiteTasksSection
          tasks={tasks}
          siteId={siteId}
          customerId={customerId}
          tenantId={site.tenant_id}
          assignableUsers={assignableUsers}
          currentUserName={currentUserName}
          currentUserAvatar={currentUserAvatar}
        />
      </div>
    </div>
  );
}
