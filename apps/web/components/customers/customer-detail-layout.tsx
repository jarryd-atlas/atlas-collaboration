"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SetPageContext } from "../layout/page-context";
import { CompactCustomerHeader } from "./compact-customer-header";
import { SitesList } from "../sites/sites-list";
import { CustomerTasksSection } from "../tasks/customer-tasks-section";
import { TaskDetailInline, type TaskForPanel } from "../tasks/task-detail-panel";
import { SiteOverviewInline } from "./site-overview-inline";
import { AddSiteButton } from "../forms/customer-actions";
import { CreateSiteDialog } from "../forms/create-site-dialog";
import { AccountPlanTabs } from "../account-plan/account-plan-tabs";
import { AccountStageTracker } from "../account-plan/account-stage-tracker";
import { EnterpriseDealCard } from "../account-plan/enterprise-deal-card";
import { WhitespaceMap } from "../account-plan/whitespace-map";
import { StrategySection } from "../account-plan/strategy-section";
import { SiteDealsSummary } from "../account-plan/site-deals-summary";
import { OrgChartTree } from "../account-plan/org-chart-tree";
import { OrgChartList } from "../account-plan/org-chart-list";
import { StakeholderForm } from "../account-plan/stakeholder-form";
import { GoalList } from "../account-plan/goal-list";
import { MilestoneTimeline } from "../account-plan/milestone-timeline";
import { AILeadershipLookup } from "../account-plan/ai-leadership-lookup";
import { CompanyIntelligence } from "../account-plan/company-intelligence";
import { AccountHealthScorecard } from "../account-plan/account-health-scorecard";
import { ExpansionPipeline } from "../account-plan/expansion-pipeline";
import { WinEvidence } from "../account-plan/win-evidence";
import { AISuccessPlan } from "../account-plan/ai-success-plan";
import { FacilityLookup } from "../account-plan/facility-lookup";
import { MeetingPrepDialog } from "../account-plan/meeting-prep-dialog";
import { CustomerMeetingsList, type CustomerMeeting } from "../account-plan/customer-meetings-list";
import { MeetingsOverviewCard } from "../account-plan/meetings-overview-card";
import { CustomerEmailsList } from "../account-plan/customer-emails-list";
import { EmailDigestCard } from "../account-plan/email-digest-card";
import { EmailSyncButton } from "../account-plan/email-sync-button";
import { MeetingSyncButton } from "../account-plan/meeting-sync-button";
import { CustomerTicketsList } from "../account-plan/customer-tickets-list";
import { TicketSyncButton } from "../account-plan/ticket-sync-button";
import { ImportSitesDialog } from "../forms/import-sites-dialog";
import type { Stakeholder } from "../account-plan/org-chart-node";
import { cn } from "../../lib/utils";
import { PanelLeftClose, PanelLeftOpen, MapPin, LayoutGrid, List, Plus } from "lucide-react";
import type { AssignableUser, AssignableSite } from "../tasks/inline-task-input";

interface TeamMember {
  id: string;
  role_label: string | null;
  department_id: string | null;
  department: { id: string; name: string; label: string; sort_order: number } | null;
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
  // Account plan props
  accountPlan?: any | null;
  stakeholders?: Stakeholder[];
  goals?: any[];
  milestones?: any[];
  enterpriseDeal?: any | null;
  profileId?: string;
  customerMeetings?: any[];
  customerEmails?: any[];
  emailDigest?: any | null;
  customerTickets?: any[];
  hubspotPortalId?: string | null;
  currentUserId?: string;
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
  accountPlan,
  stakeholders = [],
  goals = [],
  milestones = [],
  enterpriseDeal,
  profileId,
  customerMeetings = [],
  customerEmails = [],
  emailDigest = null,
  customerTickets = [],
  hubspotPortalId,
  currentUserId,
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

  // Stakeholder form state
  const [showStakeholderForm, setShowStakeholderForm] = useState(false);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | null>(null);
  const [defaultReportsTo, setDefaultReportsTo] = useState<string | null>(null);

  // Org chart view toggle
  const [orgChartView, setOrgChartView] = useState<"tree" | "list">("tree");

  // Add site from Google Places
  const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);
  const [addSiteInitial, setAddSiteInitial] = useState<{ name: string; address: string; city: string; state: string } | null>(null);
  const [prepMeeting, setPrepMeeting] = useState<CustomerMeeting | null>(null);

  // Enriched emails: stakeholders that have a title set (not just auto-added name+email)
  const enrichedEmails = useMemo(() => {
    const set = new Set<string>();
    for (const s of stakeholders) {
      if (s.email && s.title) {
        set.add(s.email.toLowerCase());
      }
    }
    return set;
  }, [stakeholders]);

  const handleAddFromGoogle = useCallback((place: { name: string; address: string; city: string; state: string }) => {
    setAddSiteInitial(place);
    setShowAddSiteDialog(true);
  }, []);

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
    (s) => s.pipeline_stage === "evaluation" || s.pipeline_stage === "qualified" || s.pipeline_stage === "contracted",
  );
  const prospectSites = sites.filter((s) => s.pipeline_stage === "prospect");
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
    setSelectedTask(null);
  }, []);

  const selectedSite = selectedSiteId ? sites.find((s) => (s.id ?? "") === selectedSiteId) : null;
  const tasksForSelectedSite = useMemo(() => {
    if (!selectedSiteId) return [];
    return tasks.filter((t) => t.site?.id === selectedSiteId);
  }, [tasks, selectedSiteId]);

  const handleEditStakeholder = useCallback((s: Stakeholder) => {
    setEditingStakeholder(s);
    setDefaultReportsTo(null);
    setShowStakeholderForm(true);
  }, []);

  const handleAddReport = useCallback((parentId: string) => {
    setEditingStakeholder(null);
    setDefaultReportsTo(parentId);
    setShowStakeholderForm(true);
  }, []);

  const handleCloseStakeholderForm = useCallback(() => {
    setShowStakeholderForm(false);
    setEditingStakeholder(null);
    setDefaultReportsTo(null);
  }, []);

  // ─── Tab content ──────────────────────────────────────────

  const overviewTab = (
    <div className="overflow-y-auto p-4 h-full space-y-4">
      <AccountStageTracker
        customerId={customer.id}
        currentStage={accountPlan?.account_stage ?? "pilot"}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EnterpriseDealCard
          deal={enterpriseDeal}
          customerId={customer.id}
          tenantId={customer.tenant_id}
          customerName={customer.name}
        />
        <WhitespaceMap
          totalSites={sites.length}
          activeSites={activeSites.length}
          deployingSites={deployingSites.length}
          evaluatingSites={evaluatingSites.length}
          prospectSites={prospectSites.length}
          totalAddressable={accountPlan?.total_addressable_sites ?? null}
        />
      </div>
      {isCKInternal && customerMeetings.length > 0 && (
        <MeetingsOverviewCard
          meetings={customerMeetings}
          customerName={customer.name}
        />
      )}
      {isCKInternal && (
        <div className="flex items-center gap-2">
          <FacilityLookup
            customerName={customer.name}
            customerDomain={customer.domain}
            customerId={customer.id}
            customerTenantId={customer.tenant_id}
            existingSites={sites}
          />
          <ImportSitesDialog
            customerName={customer.name}
            customerId={customer.id}
            customerTenantId={customer.tenant_id}
            existingSites={sites}
          />
        </div>
      )}
      <CompanyIntelligence
        customerId={customer.id}
        tenantId={customer.tenant_id}
        customerName={customer.name}
        customerDomain={customer.domain}
        accountPlan={accountPlan}
        isCKInternal={isCKInternal}
      />
      <AccountHealthScorecard
        sites={sites}
        goals={goals}
        milestones={milestones}
        stakeholders={stakeholders}
        issues={issues}
        totalAddressable={accountPlan?.total_addressable_sites ?? null}
      />
      <ExpansionPipeline
        sites={sites}
        dealLinks={dealLinks}
        totalAddressable={accountPlan?.total_addressable_sites ?? null}
      />
      <WinEvidence
        sites={sites}
        milestones={milestones}
        dealLinks={dealLinks}
      />
      <StrategySection
        customerId={customer.id}
        tenantId={customer.tenant_id}
        accountPlan={accountPlan}
      />
      <SiteDealsSummary dealLinks={dealLinks} />
    </div>
  );

  const peopleTab = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Organization ({stakeholders.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setOrgChartView("tree")}
              className={cn("p-1 rounded", orgChartView === "tree" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="Tree view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setOrgChartView("list")}
              className={cn("p-1 rounded", orgChartView === "list" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          {isCKInternal && (
            <>
              <MeetingPrepDialog
                customerName={customer.name}
                customerDomain={customer.domain}
                customerId={customer.id}
                tenantId={customer.tenant_id}
                accountPlanId={accountPlan?.id ?? ""}
                existingStakeholders={stakeholders}
              />
              <AILeadershipLookup
                customerName={customer.name}
                customerDomain={customer.domain}
                accountPlanId={accountPlan?.id ?? ""}
                tenantId={customer.tenant_id}
                existingStakeholders={stakeholders}
              />
              <button
                onClick={() => { setEditingStakeholder(null); setDefaultReportsTo(null); setShowStakeholderForm(true); }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {/* Desktop: show tree by default, list on toggle */}
        <div className={cn(orgChartView === "tree" ? "hidden lg:block" : "hidden")}>
          <OrgChartTree
            stakeholders={stakeholders}
            isCKInternal={isCKInternal}
            onEdit={handleEditStakeholder}
            onAddReport={handleAddReport}
          />
        </div>
        <div className={cn(orgChartView === "list" ? "block" : "lg:hidden")}>
          <OrgChartList
            stakeholders={stakeholders}
            isCKInternal={isCKInternal}
            onEdit={handleEditStakeholder}
            onAddReport={handleAddReport}
          />
        </div>
      </div>
    </div>
  );

  const successPlanTab = (
    <div className="overflow-y-auto p-4 h-full space-y-6">
      <AISuccessPlan
        customerName={customer.name}
        accountStage={accountPlan?.account_stage ?? "pilot"}
        accountPlanId={accountPlan?.id ?? ""}
        tenantId={customer.tenant_id}
        profileId={profileId}
        siteCount={sites.length}
        industryVertical={accountPlan?.industry_vertical}
        companyPriorities={accountPlan?.company_priorities}
        keyInitiatives={accountPlan?.key_initiatives}
        existingGoalCount={goals.length}
        existingMilestoneCount={milestones.length}
        isCKInternal={isCKInternal}
      />
      <GoalList
        goals={goals}
        accountPlanId={accountPlan?.id ?? ""}
        tenantId={customer.tenant_id}
        isCKInternal={isCKInternal}
        profileId={profileId}
      />
      <MilestoneTimeline
        milestones={milestones}
        accountPlanId={accountPlan?.id ?? ""}
        tenantId={customer.tenant_id}
        isCKInternal={isCKInternal}
        profileId={profileId}
      />
    </div>
  );

  const meetingsTab = (
    <div className="h-full flex flex-col">
      {isCKInternal && (
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Meetings
          </h3>
          <div className="flex items-center gap-2">
            {currentUserId && <MeetingSyncButton userId={currentUserId} />}
            <MeetingPrepDialog
              customerName={customer.name}
              customerDomain={customer.domain}
              customerId={customer.id}
              tenantId={customer.tenant_id}
              accountPlanId={accountPlan?.id ?? ""}
              existingStakeholders={stakeholders}
            />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <CustomerMeetingsList
          meetings={customerMeetings}
          customerName={customer.name}
          customerDomain={customer.domain}
          customerId={customer.id}
          tenantId={customer.tenant_id}
          accountPlanId={accountPlan?.id ?? ""}
          existingStakeholders={stakeholders.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email ?? null,
            title: s.title ?? null,
            department: s.department ?? null,
            stakeholder_role: s.stakeholder_role ?? null,
            notes: s.notes ?? null,
          }))}
          onPrepMeeting={(meeting) => setPrepMeeting(meeting)}
          enrichedEmails={enrichedEmails}
        />
      </div>
      {/* Meeting-triggered prep dialog (controlled externally) */}
      {isCKInternal && (
        <MeetingPrepDialog
          customerName={customer.name}
          customerDomain={customer.domain}
          customerId={customer.id}
          tenantId={customer.tenant_id}
          accountPlanId={accountPlan?.id ?? ""}
          existingStakeholders={stakeholders}
          externalOpen={!!prepMeeting}
          onExternalClose={() => setPrepMeeting(null)}
          meetingContext={prepMeeting ? {
            meetingId: prepMeeting.id,
            title: prepMeeting.title,
            meetingDate: prepMeeting.meeting_date,
            attendees: prepMeeting.attendees.map((a) => ({ name: a.name, email: a.email })),
          } : null}
        />
      )}
    </div>
  );

  const emailsTab = (
    <div className="overflow-y-auto h-full p-4 space-y-4">
      {/* Header toolbar */}
      {isCKInternal && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Email Communication
          </h3>
          {currentUserId && <EmailSyncButton userId={currentUserId} />}
        </div>
      )}
      {/* AI Communication Pulse */}
      <EmailDigestCard
        digest={emailDigest}
        customerId={customer.id}
        customerName={customer.name}
        emailCount={customerEmails.length}
      />
      {/* Email timeline */}
      <CustomerEmailsList
        emails={customerEmails}
        customerName={customer.name}
      />
    </div>
  );

  const ticketsTab = (
    <div className="overflow-y-auto h-full p-4 space-y-4">
      {/* Header toolbar */}
      {isCKInternal && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Support Tickets
          </h3>
          <TicketSyncButton customerId={customer.id} />
        </div>
      )}
      {/* Ticket list */}
      <CustomerTicketsList
        tickets={customerTickets}
        customerName={customer.name}
        hubspotPortalId={hubspotPortalId ?? undefined}
      />
    </div>
  );

  const sitesTasksTab = (
    <>
      {/* Two-column layout — desktop */}
      <div className="hidden lg:flex flex-1 overflow-hidden gap-0 h-full">
        {/* Left: Sites panel (collapsible) */}
        <div
          className={cn(
            "shrink-0 border-r border-gray-200 transition-all duration-200 flex flex-col",
            sitesCollapsed ? "w-10" : "w-80",
          )}
        >
          {sitesCollapsed ? (
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
                <span className="text-[10px] text-gray-400 font-medium"
                  style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                >
                  Sites ({sites.length})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 shrink-0">
                <h2 className="text-sm font-semibold text-gray-900">Sites</h2>
                <div className="flex items-center gap-1">
                  {isCKInternal && (
                    <>
                      <FacilityLookup
                        customerName={customer.name}
                        customerDomain={customer.domain}
                        customerId={customer.id}
                        customerTenantId={customer.tenant_id}
                        existingSites={sites}
                      />
                      <ImportSitesDialog
                        customerName={customer.name}
                        customerId={customer.id}
                        customerTenantId={customer.tenant_id}
                        existingSites={sites}
                      />
                    </>
                  )}
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
                  onAddFromGoogle={isCKInternal ? handleAddFromGoogle : undefined}
                  customerName={customer.name}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Site overview OR Tasks + inline detail */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {selectedSite ? (
            <div className="flex-1 overflow-hidden bg-white">
              <SiteOverviewInline
                site={selectedSite}
                customerSlug={customerSlug}
                customerId={customer.id}
                tasks={tasksForSelectedSite}
                assignableUsers={assignableUsers}
                currentUserName={currentUserName}
                currentUserAvatar={currentUserAvatar}
                onClose={() => setSelectedSiteId(null)}
              />
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Single-column layout — mobile */}
      <div className="lg:hidden flex-1 overflow-y-auto space-y-6 p-4">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
            <div className="flex items-center gap-2">
              {isCKInternal && (
                <>
                  <FacilityLookup
                    customerName={customer.name}
                    customerDomain={customer.domain}
                    customerId={customer.id}
                    customerTenantId={customer.tenant_id}
                    existingSites={sites}
                  />
                  <ImportSitesDialog
                    customerName={customer.name}
                    customerId={customer.id}
                    customerTenantId={customer.tenant_id}
                    existingSites={sites}
                  />
                </>
              )}
              <AddSiteButton
                customerName={customer.name}
                customerId={customer.id}
                customerTenantId={customer.tenant_id}
              />
            </div>
          </div>
          <SitesList
            sites={sites}
            customerSlug={customerSlug}
            editable={isCKInternal}
            dealLinks={dealLinks}
            hubspotEnabled={hubspotEnabled}
            onAddFromGoogle={isCKInternal ? handleAddFromGoogle : undefined}
            customerName={customer.name}
          />
        </div>
      </div>
    </>
  );

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
          accountStage={accountPlan?.account_stage}
          enterpriseDealValue={enterpriseDeal?.target_value}
        />

        {/* Tabbed content */}
        <AccountPlanTabs isCKInternal={isCKInternal}>
          {{
            overview: overviewTab,
            people: peopleTab,
            meetings: meetingsTab,
            emails: emailsTab,
            tickets: ticketsTab,
            successPlan: successPlanTab,
            sitesTasks: sitesTasksTab,
          }}
        </AccountPlanTabs>
      </div>

      {/* Stakeholder form modal */}
      {showStakeholderForm && accountPlan && (
        <StakeholderForm
          stakeholder={editingStakeholder}
          accountPlanId={accountPlan.id}
          tenantId={customer.tenant_id}
          allStakeholders={stakeholders}
          isCKInternal={isCKInternal}
          defaultReportsTo={defaultReportsTo}
          onClose={handleCloseStakeholderForm}
        />
      )}

      {/* Add site dialog — triggered from unified search */}
      {showAddSiteDialog && (
        <CreateSiteDialog
          open={showAddSiteDialog}
          onClose={() => { setShowAddSiteDialog(false); setAddSiteInitial(null); }}
          customerName={customer.name}
          customerId={customer.id}
          customerTenantId={customer.tenant_id}
          initialValues={addSiteInitial}
        />
      )}
    </>
  );
}
