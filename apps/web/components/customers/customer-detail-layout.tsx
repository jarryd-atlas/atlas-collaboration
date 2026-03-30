"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SetPageContext } from "../layout/page-context";
import { CompactCustomerHeader } from "./compact-customer-header";
import { SitesList } from "../sites/sites-list";
import { CustomerTasksSection } from "../tasks/customer-tasks-section";
import { TaskDetailInline, type TaskForPanel } from "../tasks/task-detail-panel";
import { AddSiteButton } from "../forms/customer-actions";
import { cn } from "../../lib/utils";
import { PanelLeftClose, PanelLeftOpen, MapPin } from "lucide-react";
import type { AssignableUser, AssignableSite } from "../tasks/inline-task-input";

interface TeamMember {
  id: string;
  role_label: string | null;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface InternalProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface FlaggedIssue {
  id: string;
  summary: string;
  severity: string;
  status: string;
  site?: { name: string } | null;
  flagged_by_profile?: { full_name: string } | null;
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

interface Site {
  id?: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  milestone_count?: number | null;
  task_count?: number | null;
  completed_task_count?: number | null;
  dq_reason?: string | null;
  dq_reeval_date?: string | null;
  next_step?: string | null;
  tenant_id: string;
  [key: string]: unknown;
}

interface CustomerDetailLayoutProps {
  customer: {
    id: string;
    name: string;
    domain: string | null;
    company_type: string | null;
    tenant_id: string;
  };
  customerSlug: string;
  sites: Site[];
  tasks: Task[];
  issues: FlaggedIssue[];
  isCKInternal: boolean;
  ckTeam: TeamMember[];
  internalProfiles: InternalProfile[];
  assignableUsers: AssignableUser[];
  dealLinks: any[];
  hubspotEnabled: boolean;
  currentUserName: string;
  currentUserAvatar?: string | null;
}

const STORAGE_KEY = "atlas-sites-panel-collapsed";

export function CustomerDetailLayout({
  customer,
  customerSlug,
  sites,
  tasks,
  issues,
  isCKInternal,
  ckTeam,
  internalProfiles,
  assignableUsers,
  dealLinks,
  hubspotEnabled,
  currentUserName,
  currentUserAvatar,
}: CustomerDetailLayoutProps) {
  const [sitesCollapsed, setSitesCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Persist collapse state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(sitesCollapsed));
    } catch {
      // ignore
    }
  }, [sitesCollapsed]);

  const openTasks = tasks.filter((t) => t.status !== "done");
  const activeSites = sites.filter((s) => s.pipeline_stage === "active");
  const deployingSites = sites.filter((s) => s.pipeline_stage === "deployment");
  const evaluatingSites = sites.filter(
    (s) => s.pipeline_stage === "evaluation" || s.pipeline_stage === "qualified" || s.pipeline_stage === "prospect",
  );
  const openIssues = issues.filter((i) => i.status === "open");

  const stats = {
    activeSites: activeSites.length,
    evaluatingSites: evaluatingSites.length,
    deployingSites: deployingSites.length,
    openTasks: openTasks.length,
    openIssues: openIssues.length,
  };

  const assignableSites: AssignableSite[] = sites.map((s) => ({
    id: s.id ?? "",
    name: s.name,
    slug: s.slug,
  }));

  const handleTaskSelect = useCallback((task: Task | null) => {
    setSelectedTask(task);
  }, []);

  const handleSiteSelect = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
  }, []);

  return (
    <>
      <SetPageContext customerId={customer.id} customerName={customer.name} tenantId={customer.tenant_id} />

      <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
        {/* Compact header */}
        <CompactCustomerHeader
          customer={customer}
          customerSlug={customerSlug}
          stats={stats}
          isCKInternal={isCKInternal}
          ckTeam={ckTeam}
          internalProfiles={internalProfiles}
          sites={sites as any}
        />

        {/* Two-column layout — desktop */}
        <div className="hidden lg:flex flex-1 overflow-hidden mt-4 gap-0">
          {/* Left: Sites panel (collapsible) */}
          <div
            className={cn(
              "shrink-0 border-r border-gray-200 transition-all duration-200 flex flex-col",
              sitesCollapsed ? "w-10" : "w-80",
            )}
          >
            {sitesCollapsed ? (
              /* Collapsed strip */
              <div className="flex flex-col items-center py-3 h-full">
                <button
                  onClick={() => setSitesCollapsed(false)}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Expand sites panel"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </button>
                <div className="mt-4 flex flex-col items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-medium writing-mode-vertical"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                  >
                    Sites ({sites.length})
                  </span>
                </div>
              </div>
            ) : (
              /* Expanded sites panel */
              <div className="flex flex-col h-full overflow-hidden">
                {/* Sites header */}
                <div className="flex items-center justify-between px-3 py-2 shrink-0">
                  <h2 className="text-sm font-semibold text-gray-900">Sites</h2>
                  <div className="flex items-center gap-1">
                    <AddSiteButton
                      customerName={customer.name}
                      customerId={customer.id}
                      customerTenantId={customer.tenant_id}
                    />
                    <button
                      onClick={() => setSitesCollapsed(true)}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Collapse sites panel"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Sites list */}
                <div className="flex-1 overflow-y-auto px-2 pb-3">
                  <SitesList
                    sites={sites}
                    customerSlug={customerSlug}
                    editable={isCKInternal}
                    dealLinks={dealLinks}
                    hubspotEnabled={hubspotEnabled}
                    compact
                    selectedSiteId={selectedSiteId}
                    onSiteSelect={handleSiteSelect}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right: Tasks + inline detail */}
          <div className="flex-1 flex overflow-hidden min-w-0">
            {/* Tasks list */}
            <div className={cn(
              "overflow-y-auto p-4 transition-all duration-200",
              selectedTask ? "w-[55%]" : "w-full",
            )}>
              <CustomerTasksSection
                tasks={tasks}
                customerId={customer.id}
                tenantId={customer.tenant_id}
                assignableUsers={assignableUsers}
                assignableSites={assignableSites}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                controlledSiteId={selectedSiteId}
                onTaskSelect={handleTaskSelect}
                selectedTaskId={selectedTask?.id}
                issues={issues}
              />
            </div>

            {/* Inline task detail */}
            {selectedTask && (
              <div className="w-[45%] border-l border-gray-200 bg-white overflow-hidden">
                <TaskDetailInline
                  task={selectedTask as TaskForPanel}
                  onClose={() => setSelectedTask(null)}
                  tenantId={customer.tenant_id}
                  currentUserName={currentUserName}
                  currentUserAvatar={currentUserAvatar}
                />
              </div>
            )}
          </div>
        </div>

        {/* Single-column layout — mobile */}
        <div className="lg:hidden flex-1 overflow-y-auto mt-4 space-y-6">
          {/* Tasks first on mobile */}
          <CustomerTasksSection
            tasks={tasks}
            customerId={customer.id}
            tenantId={customer.tenant_id}
            assignableUsers={assignableUsers}
            assignableSites={assignableSites}
            currentUserName={currentUserName}
            currentUserAvatar={currentUserAvatar}
            issues={issues}
          />

          {/* Sites */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
              <AddSiteButton
                customerName={customer.name}
                customerId={customer.id}
                customerTenantId={customer.tenant_id}
              />
            </div>
            <SitesList
              sites={sites}
              customerSlug={customerSlug}
              editable={isCKInternal}
              dealLinks={dealLinks}
              hubspotEnabled={hubspotEnabled}
            />
          </div>
        </div>
      </div>
    </>
  );
}
