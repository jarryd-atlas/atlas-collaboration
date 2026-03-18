import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSiteBySlug,
  getCustomerBySlug,
  getMilestonesForSite,
} from "../../../../../../lib/data/queries";
import { PipelineStageBadge, StatusBadge, PriorityBadge } from "../../../../../../components/ui/badge";
import { ProgressBar } from "../../../../../../components/ui/progress-bar";
import { EmptyState } from "../../../../../../components/ui/empty-state";
import { AddMilestoneButton, ChangeStageButton } from "../../../../../../components/forms/site-actions";
import {
  ArrowRight,
  MapPin,
  Calendar,
  Target,
} from "lucide-react";
import type { SitePipelineStage } from "@repo/shared";

interface SitePageProps {
  params: Promise<{ customerSlug: string; siteSlug: string }>;
}

const PIPELINE_STEPS: SitePipelineStage[] = [
  "prospect",
  "evaluation",
  "qualified",
  "contracted",
  "deployment",
  "active",
];

export default async function SitePage({ params }: SitePageProps) {
  const { customerSlug, siteSlug } = await params;

  let site: Awaited<ReturnType<typeof getSiteBySlug>> = null;
  let customer: Awaited<ReturnType<typeof getCustomerBySlug>> = null;

  try {
    [site, customer] = await Promise.all([
      getSiteBySlug(customerSlug, siteSlug),
      getCustomerBySlug(customerSlug),
    ]);
  } catch {
    return notFound();
  }

  if (!site || !customer) return notFound();

  let milestones: Awaited<ReturnType<typeof getMilestonesForSite>> = [];
  try {
    milestones = await getMilestonesForSite(site.id);
  } catch {
    // Show empty milestones
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <p className="text-sm text-gray-400 mb-1">
          <Link href="/customers" className="hover:text-gray-600">Customers</Link>
          {" / "}
          <Link href={`/customers/${customerSlug}`} className="hover:text-gray-600">{customer.name}</Link>
        </p>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            {site.city && (
              <p className="text-gray-500 mt-1 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {site.address && `${site.address}, `}{site.city}, {site.state}
              </p>
            )}
          </div>
          <PipelineStageBadge stage={site.pipeline_stage} />
        </div>
      </div>

      {/* Pipeline stage tracker */}
      {site.pipeline_stage !== "disqualified" && site.pipeline_stage !== "paused" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Pipeline Stage</h2>
            <ChangeStageButton siteName={site.name} currentStage={site.pipeline_stage} />
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
          <AddMilestoneButton siteName={site.name} />
        </div>

        {milestones.length === 0 ? (
          <EmptyState
            icon={<Target className="h-12 w-12" />}
            title="No milestones yet"
            description="Create milestones to track project progress at this site."
            action={<AddMilestoneButton siteName={site.name} />}
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
    </div>
  );
}
