"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { SetPageContext } from "../layout/page-context";
import { CompactCustomerHeader } from "./compact-customer-header";
import { SitesList } from "../sites/sites-list";
import { CustomerTasksSection } from "../tasks/customer-tasks-section";
import { TaskDetailInline, type TaskForPanel } from "../tasks/task-detail-panel";
import { SiteOverviewInline } from "./site-overview-inline";
import { AddSiteButton } from "../forms/customer-actions";
import { CreateSiteDialog } from "../forms/create-site-dialog";
import { AccountStageTracker } from "../account-plan/account-stage-tracker";
import { EnterpriseDealCard } from "../account-plan/enterprise-deal-card";
import { MeetingsOverviewCard } from "../account-plan/meetings-overview-card";
import type { CustomerMeeting } from "../account-plan/customer-meetings-list";
import type { Stakeholder } from "../account-plan/org-chart-node";
import { cn } from "../../lib/utils";
import { PanelLeftClose, PanelLeftOpen, MapPin, LayoutGrid, List, Plus, Table2, GitBranch } from "lucide-react";
import type { AssignableUser, AssignableSite } from "../tasks/inline-task-input";
import { CustomerTasksTable } from "../tasks/customer-tasks-table";
import { SitesTable } from "../sites/sites-table";
import { BusinessUnitsManager } from "./business-units-manager";

// ── Lazy-loaded heavy components (only loaded when their tab is active) ──
const loadingSpinner = () => (
  <div className="flex items-center justify-center py-12 text-sm text-gray-400">Loading...</div>
);

const AccountPlanTabs = dynamic(() => import("../account-plan/account-plan-tabs").then(m => m.AccountPlanTabs), { loading: loadingSpinner });
const WhitespaceMap = dynamic(() => import("../account-plan/whitespace-map").then(m => m.WhitespaceMap), { loading: loadingSpinner });
const StrategySection = dynamic(() => import("../account-plan/strategy-section").then(m => m.StrategySection), { loading: loadingSpinner });
const SiteDealsSummary = dynamic(() => import("../account-plan/site-deals-summary").then(m => m.SiteDealsSummary), { loading: loadingSpinner });
const OrgChartTree = dynamic(() => import("../account-plan/org-chart-tree").then(m => m.OrgChartTree), { loading: loadingSpinner });
const OrgChartList = dynamic(() => import("../account-plan/org-chart-list").then(m => m.OrgChartList), { loading: loadingSpinner });
const StakeholderForm = dynamic(() => import("../account-plan/stakeholder-form").then(m => m.StakeholderForm), { loading: loadingSpinner });
const GoalList = dynamic(() => import("../account-plan/goal-list").then(m => m.GoalList), { loading: loadingSpinner });
const MilestoneTimeline = dynamic(() => import("../account-plan/milestone-timeline").then(m => m.MilestoneTimeline), { loading: loadingSpinner });
const AILeadershipLookup = dynamic(() => import("../account-plan/ai-leadership-lookup").then(m => m.AILeadershipLookup), { loading: loadingSpinner });
const CompanyIntelligence = dynamic(() => import("../account-plan/company-intelligence").then(m => m.CompanyIntelligence), { loading: loadingSpinner });
const AccountHealthScorecard = dynamic(() => import("../account-plan/account-health-scorecard").then(m => m.AccountHealthScorecard), { loading: loadingSpinner });
const ExpansionPipeline = dynamic(() => import("../account-plan/expansion-pipeline").then(m => m.ExpansionPipeline), { loading: loadingSpinner });
const WinEvidence = dynamic(() => import("../account-plan/win-evidence").then(m => m.WinEvidence), { loading: loadingSpinner });
const AISuccessPlan = dynamic(() => import("../account-plan/ai-success-plan").then(m => m.AISuccessPlan), { loading: loadingSpinner });
const FacilityLookup = dynamic(() => import("../account-plan/facility-lookup").then(m => m.FacilityLookup), { loading: loadingSpinner });
const MeetingPrepDialog = dynamic(() => import("../account-plan/meeting-prep-dialog").then(m => m.MeetingPrepDialog), { loading: loadingSpinner });
const CustomerMeetingsList = dynamic(() => import("../account-plan/customer-meetings-list").then(m => m.CustomerMeetingsList), { loading: loadingSpinner });
const CustomerEmailsList = dynamic(() => import("../account-plan/customer-emails-list").then(m => m.CustomerEmailsList), { loading: loadingSpinner });
const EmailDigestCard = dynamic(() => import("../account-plan/email-digest-card").then(m => m.EmailDigestCard), { loading: loadingSpinner });
const EmailSyncButton = dynamic(() => import("../account-plan/email-sync-button").then(m => m.EmailSyncButton), { loading: loadingSpinner });
const MeetingSyncButton = dynamic(() => import("../account-plan/meeting-sync-button").then(m => m.MeetingSyncButton), { loading: loadingSpinner });
const CustomerTicketsList = dynamic(() => import("../account-plan/customer-tickets-list").then(m => m.CustomerTicketsList), { loading: loadingSpinner });
const TicketSyncButton = dynamic(() => import("../account-plan/ticket-sync-button").then(m => m.TicketSyncButton), { loading: loadingSpinner });
const ImportSitesDialog = dynamic(() => import("../forms/import-sites-dialog").then(m => m.ImportSitesDialog), { loading: loadingSpinner });
const InitiativesTab = dynamic(() => import("../initiatives/initiatives-tab").then(m => m.InitiativesTab), { loading: loadingSpinner });
const ContactDirectory = dynamic(() => import("../account-plan/contact-directory").then(m => m.ContactDirectory), { loading: loadingSpinner });
const SalesIntelligenceSection = dynamic(() => import("../account-plan/sales-intelligence-section").then(m => m.SalesIntelligenceSection), { loading: loadingSpinner });

const SiteMapEmbed = dynamic(
  () => import("../maps/site-map").then((m) => {
    const { SiteMap } = m;
    // Wrapper to pass showCustomer=false and height
    return function SiteMapEmbed(props: { sites: any[]; customerSlug: string }) {
      return <SiteMap sites={props.sites} showCustomer={false} height="100%" customerSlug={props.customerSlug} />;
    };
  }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading map...
      </div>
    ),
  },
);

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
    hq_address?: string | null;
    hq_city?: string | null;
    hq_state?: string | null;
    hq_zip?: string | null;
    hq_latitude?: number | null;
    hq_longitude?: number | null;
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
  initiatives?: any[];
  businessUnits?: { id: string; name: string; slug: string }[];
  buyingTriggers?: any[];
  accountObjections?: any[];
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
  initiatives = [],
  businessUnits = [],
  buyingTriggers = [],
  accountObjections = [],
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

  // People view toggle
  const [peopleView, setPeopleView] = useState<"directory" | "tree" | "list">("directory");

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
      {isCKInternal && (
        <BusinessUnitsManager
          customerId={customer.id}
          tenantId={customer.tenant_id}
          businessUnits={businessUnits}
        />
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
      {isCKInternal && (
        <SalesIntelligenceSection
          customerId={customer.id}
          tenantId={customer.tenant_id}
          buyingTriggers={buyingTriggers}
          objections={accountObjections}
          stakeholders={stakeholders}
        />
      )}
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
      <CustomerTasksTable
        tasks={tasks}
        assignableUsers={assignableUsers}
        onSelectTask={handleTaskSelect}
      />
    </div>
  );

  const peopleTab = (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {peopleView === "directory" ? "Contact Directory" : "Organization"} ({stakeholders.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle: Directory | Tree | List */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setPeopleView("directory")}
              className={cn("p-1 rounded", peopleView === "directory" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="Directory view"
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPeopleView("tree")}
              className={cn("p-1 rounded", peopleView === "tree" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
              title="Org chart tree"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPeopleView("list")}
              className={cn("p-1 rounded", peopleView === "list" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600")}
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
        {peopleView === "directory" && (
          <ContactDirectory
            stakeholders={stakeholders}
            isCKInternal={isCKInternal}
            onEdit={handleEditStakeholder}
            onAdd={() => { setEditingStakeholder(null); setDefaultReportsTo(null); setShowStakeholderForm(true); }}
          />
        )}
        {peopleView === "tree" && (
          <OrgChartTree
            stakeholders={stakeholders}
            isCKInternal={isCKInternal}
            onEdit={handleEditStakeholder}
            onAddReport={handleAddReport}
          />
        )}
        {peopleView === "list" && (
          <OrgChartList
            stakeholders={stakeholders}
            isCKInternal={isCKInternal}
            onEdit={handleEditStakeholder}
            onAddReport={handleAddReport}
          />
        )}
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

  // Map stakeholders to the format expected by InitiativesTab
  const stakeholdersForInitiatives = stakeholders.map((s: any) => ({
    id: s.id,
    name: s.name ?? "",
    email: s.email ?? null,
    title: s.title ?? null,
    company: s.company ?? null,
    is_ck_internal: s.is_ck_internal ?? false,
  }));

  // Map tasks for initiative linking
  const tasksForInitiatives = tasks.map((t: any) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assignee?.id ?? null,
    assignee: t.assignee ?? null,
    due_date: t.due_date ?? null,
  }));

  const initiativesTab = (
    <InitiativesTab
      initiatives={initiatives}
      customerId={customer.id}
      tenantId={customer.tenant_id}
      accountPlanId={accountPlan?.id}
      assignableUsers={assignableUsers}
      stakeholders={stakeholdersForInitiatives}
      customerTasks={tasksForInitiatives}
      isCKInternal={isCKInternal}
      currentUserName={currentUserName}
      currentUserAvatar={currentUserAvatar}
      profileId={profileId}
    />
  );

  // Map tab — show sites with coordinates on a Google Map
  const sitesWithCoordinates = sites.filter(
    (s: any) => s.latitude != null && s.longitude != null,
  );

  const mapTab = (
    <div className="h-full">
      <SiteMapEmbed
        sites={sitesWithCoordinates.map((s: any) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          address: s.address,
          city: s.city,
          state: s.state,
          pipeline_stage: s.pipeline_stage,
          latitude: s.latitude as number,
          longitude: s.longitude as number,
        }))}
        customerSlug={customerSlug}
      />
    </div>
  );

  const sitesTasksTab = (
    <div className="overflow-y-auto p-4 h-full">
      <SitesTable
        sites={sites}
        customerSlug={customerSlug}
        dealLinks={dealLinks}
        isCKInternal={isCKInternal}
        businessUnits={businessUnits}
        onAddSite={isCKInternal ? () => setShowAddSiteDialog(true) : undefined}
      />
    </div>
  );

  return (
    <>
      <SetPageContext customerId={customer.id} customerName={customer.name} tenantId={customer.tenant_id} />

      <div className="-mx-6 -mt-6 -mb-24 flex flex-col overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
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
          championStatus={
            (() => {
              const champs = stakeholders.filter((s: any) => s.stakeholder_role === "champion");
              if (champs.length === 0) return stakeholders.length > 0 ? "none" as const : undefined;
              const atRisk = champs.some((s: any) => s.relationship_strength === "weak" || s.relationship_strength === "developing");
              return atRisk ? "at_risk" as const : "healthy" as const;
            })()
          }
        />

        {/* Tabbed content */}
        <AccountPlanTabs isCKInternal={isCKInternal}>
          {{
            overview: overviewTab,
            people: peopleTab,
            initiatives: initiativesTab,
            meetings: meetingsTab,
            emails: emailsTab,
            tickets: ticketsTab,
            successPlan: successPlanTab,
            sitesTasks: sitesTasksTab,
            map: mapTab,
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
          sites={sites.filter((s): s is typeof s & { id: string } => !!s.id)}
          customerId={customer.id}
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
