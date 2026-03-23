"use client";

import Link from "next/link";
import { PipelineStageBadge, StatusBadge, PriorityBadge } from "../ui/badge";
import { ProgressBar } from "../ui/progress-bar";
import { EmptyState } from "../ui/empty-state";
import { AddMilestoneButton, ChangeStageButton } from "../forms/site-actions";
import { SiteDocumentsManager } from "../documents";
import { SiteTasksSection } from "../tasks/site-tasks-section";
import { ArrowRight, Calendar, Target } from "lucide-react";
import type { SitePipelineStage } from "@repo/shared";

const PIPELINE_STEPS: SitePipelineStage[] = [
  "prospect",
  "evaluation",
  "qualified",
  "contracted",
  "deployment",
  "active",
];

interface OverviewTabProps {
  site: any;
  customer: any;
  customerSlug: string;
  siteSlug: string;
  milestones: any[];
  tasksWithComments: any[];
  assignableUsers: any[];
  currentUserName: string;
  currentUserAvatar: string | undefined;
  canAnalyze?: boolean;
  assessmentId?: string;
}

export function OverviewTab({
  site,
  customer,
  customerSlug,
  siteSlug,
  milestones,
  tasksWithComments,
  assignableUsers,
  currentUserName,
  currentUserAvatar,
  canAnalyze = false,
  assessmentId,
}: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {/* Pipeline stage tracker */}
      {site.pipeline_stage !== "disqualified" && site.pipeline_stage !== "paused" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Pipeline Stage</h2>
            <ChangeStageButton siteName={site.name} siteId={site.id} currentStage={site.pipeline_stage} />
          </div>
          <div className="flex items-center gap-1">
            {PIPELINE_STEPS.map((step, i) => {
              const currentIdx = PIPELINE_STEPS.indexOf(site.pipeline_stage as SitePipelineStage);
              const isCompleted = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={step} className="flex-1">
                  <div
                    className={`h-2 rounded-full ${
                      isCompleted
                        ? "bg-brand-green"
                        : isCurrent
                          ? "bg-brand-green/50"
                          : "bg-gray-100"
                    }`}
                  />
                  <p
                    className={`text-xs mt-1.5 ${
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Milestones ({milestones.length})
          </h2>
          <AddMilestoneButton siteName={site.name} siteId={site.id} tenantId={site.tenant_id} />
        </div>

        {milestones.length === 0 ? (
          <EmptyState
            icon={<Target className="h-12 w-12" />}
            title="No milestones yet"
            description="Create milestones to track project progress at this site."
            action={<AddMilestoneButton siteName={site.name} siteId={site.id} tenantId={site.tenant_id} />}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
            {milestones.map((milestone) => (
              <Link
                key={milestone.slug}
                href={`/customers/${customerSlug}/sites/${siteSlug}/milestones/${milestone.slug}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {milestone.name}
                    </h3>
                    <StatusBadge status={milestone.status} />
                    <PriorityBadge priority={milestone.priority} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {milestone.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {milestone.due_date}
                      </span>
                    )}
                    <span>
                      {milestone.completed_task_count ?? 0}/{milestone.task_count ?? 0} tasks
                    </span>
                  </div>
                </div>
                <div className="w-32 shrink-0">
                  <ProgressBar value={milestone.progress ?? 0} size="sm" showLabel />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tasks for this site */}
      <SiteTasksSection
        tasks={tasksWithComments}
        siteId={site.id}
        customerId={customer.id}
        tenantId={site.tenant_id}
        assignableUsers={assignableUsers}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
      />

      {/* Documents */}
      <SiteDocumentsManager
        entityType="site"
        entityId={site.id}
        tenantId={site.tenant_id}
        canAnalyze={canAnalyze}
        siteId={site.id}
      />
    </div>
  );
}
