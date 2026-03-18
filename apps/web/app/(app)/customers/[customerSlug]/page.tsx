import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomerBySlug,
  getSitesForCustomer,
  getFlaggedIssuesForCustomer,
} from "../../../../lib/mock-data";
import { PipelineStageBadge, SeverityBadge, StatusBadge } from "../../../../components/ui/badge";
import { ProgressBar } from "../../../../components/ui/progress-bar";
import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/empty-state";
import { CustomerActions, AddSiteButton } from "../../../../components/forms/customer-actions";
import {
  MapPin,
  Plus,
} from "lucide-react";

interface CustomerPageProps {
  params: Promise<{ customerSlug: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { customerSlug } = await params;
  const customer = getCustomerBySlug(customerSlug);

  if (!customer) return notFound();

  const sites = getSitesForCustomer(customerSlug);
  const issues = getFlaggedIssuesForCustomer(customerSlug);

  const activeSites = sites.filter((s) => s.pipelineStage === "active");
  const deployingSites = sites.filter((s) => s.pipelineStage === "deployment");
  const evaluatingSites = sites.filter(
    (s) => s.pipelineStage === "evaluation" || s.pipelineStage === "qualified" || s.pipelineStage === "prospect",
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">
            <Link href="/customers" className="hover:text-gray-600">Customers</Link>
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {customer.domain && (
            <p className="text-gray-500 mt-1">{customer.domain}</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <CustomerActions customerName={customer.name} sites={sites} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MiniStat label="Active Sites" value={activeSites.length} />
        <MiniStat label="In Evaluation" value={evaluatingSites.length} />
        <MiniStat label="Deploying" value={deployingSites.length} />
        <MiniStat label="Open Issues" value={issues.filter((i) => i.status === "open").length} accent />
      </div>

      {/* Sites */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
          <AddSiteButton customerName={customer.name} />
        </div>

        {sites.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-12 w-12" />}
            title="No sites yet"
            description="Add a site to start tracking milestones and tasks."
            action={<AddSiteButton customerName={customer.name} />}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <Link
                key={site.slug}
                href={`/customers/${customerSlug}/sites/${site.slug}`}
                className={`group rounded-xl border bg-white p-5 shadow-card hover:shadow-card-hover transition-shadow ${
                  site.pipelineStage === "disqualified" ? "border-gray-200 opacity-60" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-dark">
                      {site.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {site.city}, {site.state}
                    </p>
                  </div>
                  <PipelineStageBadge stage={site.pipelineStage} />
                </div>

                {site.pipelineStage === "disqualified" ? (
                  <div className="text-xs text-gray-400">
                    <p>{site.dqReason}</p>
                    {site.dqReevalDate && <p className="mt-1">Re-eval: {site.dqReevalDate}</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{site.milestoneCount} milestones</span>
                      <span>
                        {site.completedTaskCount}/{site.taskCount} tasks
                      </span>
                    </div>
                    {site.taskCount > 0 && (
                      <ProgressBar
                        value={Math.round((site.completedTaskCount / site.taskCount) * 100)}
                        size="sm"
                      />
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Flagged issues */}
      {issues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Flagged Issues ({issues.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {issues.map((issue) => (
              <div key={issue.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{issue.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {issue.siteName} &middot; {issue.flaggedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={issue.severity} />
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
      <p className={`text-xl font-bold ${accent && value > 0 ? "text-error" : "text-gray-900"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
