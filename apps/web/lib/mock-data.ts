/**
 * Mock data for Phase 1b development.
 * Matches the sample data set from the plan/mockups.
 * Will be replaced by Supabase queries when auth is connected.
 */

import type {
  SitePipelineStage,
  MilestoneStatus,
  TaskStatus,
  Priority,
  Role,
  TenantType,
  SeverityLevel,
  IssueStatus,
} from "@repo/shared";

// ─── Types (matching DB schema) ──────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  domain: string | null;
}

export interface Profile {
  id: string;
  userId: string | null;
  tenantId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  status: "active" | "pending" | "pending_approval" | "disabled";
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  domain: string | null;
  logoUrl: string | null;
  activeSites: number;
  totalSites: number;
}

export interface Site {
  id: string;
  customerId: string;
  tenantId: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pipelineStage: SitePipelineStage;
  dqReason: string | null;
  dqReevalDate: string | null;
  metadata: Record<string, unknown>;
  milestoneCount: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface Milestone {
  id: string;
  siteId: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  status: MilestoneStatus;
  priority: Priority;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  templateId: string | null;
  taskCount: number;
  completedTaskCount: number;
}

export interface Task {
  id: string;
  milestoneId: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  source: "manual" | "ai_extracted";
}

export interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
}

export interface FlaggedIssue {
  id: string;
  siteId: string;
  siteName: string;
  tenantId: string;
  severity: SeverityLevel;
  summary: string;
  details: string | null;
  status: IssueStatus;
  flaggedBy: string;
  flaggedByName: string;
  createdAt: string;
}

// ─── Voice Note Types ────────────────────────────────────────

export type VoiceNoteStatus = "uploading" | "transcribing" | "summarizing" | "ready" | "error";

export interface VoiceNote {
  id: string;
  tenantId: string;
  title: string;
  duration: number; // seconds
  status: VoiceNoteStatus;
  audioUrl: string | null;
  recordedBy: string;
  recordedByName: string;
  siteId: string | null;
  siteName: string | null;
  milestoneId: string | null;
  milestoneName: string | null;
  transcript: string | null;
  summary: string | null;
  extractedTasks: ExtractedTask[];
  extractedDecisions: string[];
  extractedUpdates: string[];
  errorMessage: string | null;
  createdAt: string;
}

export interface ExtractedTask {
  id: string;
  title: string;
  assigneeName: string | null;
  dueDate: string | null;
  priority: Priority;
  status: "pending" | "approved" | "dismissed";
}

// ─── CK Tenant ──────────────────────────────────────────────

const CK_TENANT: Tenant = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "CrossnoKaye",
  type: "internal",
  domain: "crossnokaye.com",
};

// ─── CK Team ────────────────────────────────────────────────

export const MOCK_PROFILES: Profile[] = [
  {
    id: "p-jake",
    userId: "u-jake",
    tenantId: CK_TENANT.id,
    email: "jake@crossnokaye.com",
    fullName: "Jake Dawson",
    avatarUrl: null,
    role: "super_admin",
    status: "active",
  },
  {
    id: "p-sarah",
    userId: "u-sarah",
    tenantId: CK_TENANT.id,
    email: "sarah@crossnokaye.com",
    fullName: "Sarah Kim",
    avatarUrl: null,
    role: "admin",
    status: "active",
  },
  {
    id: "p-mike",
    userId: "u-mike",
    tenantId: CK_TENANT.id,
    email: "mike@crossnokaye.com",
    fullName: "Mike Chen",
    avatarUrl: null,
    role: "member",
    status: "active",
  },
  {
    id: "p-james",
    userId: "u-james",
    tenantId: CK_TENANT.id,
    email: "james@crossnokaye.com",
    fullName: "James Park",
    avatarUrl: null,
    role: "member",
    status: "active",
  },
  {
    id: "p-alex",
    userId: "u-alex",
    tenantId: CK_TENANT.id,
    email: "alex@crossnokaye.com",
    fullName: "Alex Rivera",
    avatarUrl: null,
    role: "member",
    status: "active",
  },
  // Customer users
  {
    id: "p-tom",
    userId: "u-tom",
    tenantId: "t-americold",
    email: "tom@americold.com",
    fullName: "Tom Bradley",
    avatarUrl: null,
    role: "admin",
    status: "active",
  },
  {
    id: "p-rachel",
    userId: "u-rachel",
    tenantId: "t-americold",
    email: "rachel@americold.com",
    fullName: "Rachel Liu",
    avatarUrl: null,
    role: "member",
    status: "active",
  },
  // Pending users
  {
    id: "p-kevin",
    userId: null,
    tenantId: "t-americold",
    email: "kevin@americold.com",
    fullName: "Kevin Nguyen",
    avatarUrl: null,
    role: "member",
    status: "pending",
  },
  {
    id: "p-hannah",
    userId: null,
    tenantId: "t-newcold",
    email: "hannah@newcold.com",
    fullName: "Hannah Sato",
    avatarUrl: null,
    role: "member",
    status: "pending_approval",
  },
];

// ─── Customers ──────────────────────────────────────────────

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "c-americold",
    tenantId: "t-americold",
    name: "Americold Realty Trust",
    slug: "americold",
    domain: "americold.com",
    logoUrl: null,
    activeSites: 3,
    totalSites: 6,
  },
  {
    id: "c-lineage",
    tenantId: "t-lineage",
    name: "Lineage Logistics",
    slug: "lineage",
    domain: "lineagelogistics.com",
    logoUrl: null,
    activeSites: 2,
    totalSites: 4,
  },
  {
    id: "c-newcold",
    tenantId: "t-newcold",
    name: "NewCold",
    slug: "newcold",
    domain: "newcold.com",
    logoUrl: null,
    activeSites: 1,
    totalSites: 2,
  },
];

// ─── Sites ──────────────────────────────────────────────────

export const MOCK_SITES: Site[] = [
  {
    id: "s-denver",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Denver Distribution Center",
    slug: "denver-distribution-center",
    address: "4800 Brighton Blvd",
    city: "Denver",
    state: "CO",
    pipelineStage: "active",
    dqReason: null,
    dqReevalDate: null,
    metadata: {},
    milestoneCount: 5,
    taskCount: 18,
    completedTaskCount: 12,
  },
  {
    id: "s-atlanta",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Atlanta Cold Storage",
    slug: "atlanta-cold-storage",
    address: "1200 Peachtree Industrial Blvd",
    city: "Atlanta",
    state: "GA",
    pipelineStage: "active",
    dqReason: null,
    dqReevalDate: null,
    metadata: {},
    milestoneCount: 3,
    taskCount: 9,
    completedTaskCount: 5,
  },
  {
    id: "s-dallas",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Dallas Logistics Hub",
    slug: "dallas-logistics-hub",
    address: "800 Commerce St",
    city: "Dallas",
    state: "TX",
    pipelineStage: "deployment",
    dqReason: null,
    dqReevalDate: null,
    metadata: {},
    milestoneCount: 1,
    taskCount: 4,
    completedTaskCount: 0,
  },
  {
    id: "s-chicago",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Chicago Freezer Facility",
    slug: "chicago-freezer-facility",
    address: "500 S Wacker Dr",
    city: "Chicago",
    state: "IL",
    pipelineStage: "evaluation",
    dqReason: null,
    dqReevalDate: null,
    metadata: {},
    milestoneCount: 0,
    taskCount: 0,
    completedTaskCount: 0,
  },
  {
    id: "s-portland",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Portland Cold Chain",
    slug: "portland-cold-chain",
    address: "2100 NW Front Ave",
    city: "Portland",
    state: "OR",
    pipelineStage: "qualified",
    dqReason: null,
    dqReevalDate: null,
    metadata: {},
    milestoneCount: 0,
    taskCount: 0,
    completedTaskCount: 0,
  },
  {
    id: "s-phoenix",
    customerId: "c-americold",
    tenantId: "t-americold",
    name: "Phoenix Warehouse",
    slug: "phoenix-warehouse",
    address: "3300 N Central Ave",
    city: "Phoenix",
    state: "AZ",
    pipelineStage: "disqualified",
    dqReason: "Facility too small for ATLAS deployment",
    dqReevalDate: "2026-06-15",
    metadata: {},
    milestoneCount: 0,
    taskCount: 0,
    completedTaskCount: 0,
  },
];

// ─── Milestones (Denver site) ───────────────────────────────

export const MOCK_MILESTONES: Milestone[] = [
  {
    id: "m-phase2",
    siteId: "s-denver",
    tenantId: "t-americold",
    name: "ATLAS Phase 2 Deployment",
    slug: "atlas-phase-2-deployment",
    description: "Deploy Phase 2 ATLAS sensors and monitoring across Zones B-D",
    status: "in_progress",
    priority: "high",
    progress: 65,
    startDate: "2026-01-15",
    dueDate: "2026-04-30",
    completedAt: null,
    templateId: null,
    taskCount: 5,
    completedTaskCount: 2,
  },
  {
    id: "m-energy",
    siteId: "s-denver",
    tenantId: "t-americold",
    name: "Energy Optimization Study",
    slug: "energy-optimization-study",
    description: "Analyze energy consumption patterns and identify optimization opportunities",
    status: "not_started",
    priority: "medium",
    progress: 10,
    startDate: "2026-03-01",
    dueDate: "2026-06-30",
    completedAt: null,
    templateId: null,
    taskCount: 3,
    completedTaskCount: 0,
  },
  {
    id: "m-compressor",
    siteId: "s-denver",
    tenantId: "t-americold",
    name: "Compressor Monitoring Upgrade",
    slug: "compressor-monitoring-upgrade",
    description: "Upgrade compressor monitoring with vibration and thermal sensors",
    status: "completed",
    priority: "medium",
    progress: 100,
    startDate: "2025-10-01",
    dueDate: "2026-01-15",
    completedAt: "2026-01-10",
    templateId: null,
    taskCount: 6,
    completedTaskCount: 6,
  },
  {
    id: "m-safety",
    siteId: "s-denver",
    tenantId: "t-americold",
    name: "Safety Compliance Review",
    slug: "safety-compliance-review",
    description: "Annual safety compliance audit and remediation",
    status: "in_progress",
    priority: "high",
    progress: 35,
    startDate: "2026-02-01",
    dueDate: "2026-05-15",
    completedAt: null,
    templateId: null,
    taskCount: 4,
    completedTaskCount: 1,
  },
  {
    id: "m-ammonia",
    siteId: "s-denver",
    tenantId: "t-americold",
    name: "Ammonia Leak Detection System",
    slug: "ammonia-leak-detection-system",
    description: "Install and configure ammonia leak detection sensors throughout the facility",
    status: "not_started",
    priority: "urgent",
    progress: 5,
    startDate: "2026-04-01",
    dueDate: "2026-07-31",
    completedAt: null,
    templateId: null,
    taskCount: 2,
    completedTaskCount: 0,
  },
];

// ─── Tasks (Phase 2 milestone) ──────────────────────────────

export const MOCK_TASKS: Task[] = [
  {
    id: "t-sensor",
    milestoneId: "m-phase2",
    tenantId: "t-americold",
    title: "Install sensor array in Zone B",
    description: "Deploy 24 temperature and humidity sensors across Zone B cold storage area",
    status: "done",
    priority: "high",
    assigneeId: "p-mike",
    assigneeName: "Mike Chen",
    dueDate: "2026-02-28",
    source: "manual",
  },
  {
    id: "t-alerting",
    milestoneId: "m-phase2",
    tenantId: "t-americold",
    title: "Configure alerting thresholds",
    description: "Set up temperature deviation alerts and escalation rules for Zone B sensors",
    status: "todo",
    priority: "medium",
    assigneeId: "p-sarah",
    assigneeName: "Sarah Kim",
    dueDate: "2026-03-15",
    source: "manual",
  },
  {
    id: "t-validate",
    milestoneId: "m-phase2",
    tenantId: "t-americold",
    title: "Validate historical data import",
    description: "Verify 6 months of historical sensor data imported correctly into ATLAS",
    status: "done",
    priority: "medium",
    assigneeId: "p-james",
    assigneeName: "James Park",
    dueDate: "2026-02-15",
    source: "manual",
  },
  {
    id: "t-training",
    milestoneId: "m-phase2",
    tenantId: "t-americold",
    title: "Schedule training session with ops team",
    description: "Coordinate with Americold ops team for ATLAS dashboard training",
    status: "todo",
    priority: "low",
    assigneeId: null,
    assigneeName: null,
    dueDate: "2026-04-15",
    source: "manual",
  },
  {
    id: "t-commissioning",
    milestoneId: "m-phase2",
    tenantId: "t-americold",
    title: "Review commissioning checklist",
    description: "Final review of all commissioning items before Phase 2 go-live",
    status: "in_review",
    priority: "high",
    assigneeId: "p-alex",
    assigneeName: "Alex Rivera",
    dueDate: "2026-04-20",
    source: "manual",
  },
  // Additional tasks for other milestones
  {
    id: "t-energy-audit",
    milestoneId: "m-energy",
    tenantId: "t-americold",
    title: "Conduct energy audit baseline",
    description: "Measure current energy consumption across all cold storage zones",
    status: "todo",
    priority: "medium",
    assigneeId: "p-james",
    assigneeName: "James Park",
    dueDate: "2026-03-30",
    source: "manual",
  },
  {
    id: "t-safety-docs",
    milestoneId: "m-safety",
    tenantId: "t-americold",
    title: "Compile safety documentation",
    description: "Gather all required safety compliance documents for annual review",
    status: "in_progress",
    priority: "high",
    assigneeId: "p-sarah",
    assigneeName: "Sarah Kim",
    dueDate: "2026-03-20",
    source: "manual",
  },
];

// ─── Comments ───────────────────────────────────────────────

export const MOCK_COMMENTS: Comment[] = [
  {
    id: "cm-1",
    entityType: "task",
    entityId: "t-sensor",
    tenantId: "t-americold",
    authorId: "p-mike",
    authorName: "Mike Chen",
    authorAvatar: null,
    body: "Sensors installed in rows 1-12. Waiting on Zone B-East access clearance from Americold facilities team.",
    createdAt: "2026-03-10T14:30:00Z",
  },
  {
    id: "cm-2",
    entityType: "task",
    entityId: "t-sensor",
    tenantId: "t-americold",
    authorId: "p-tom",
    authorName: "Tom Bradley",
    authorAvatar: null,
    body: "Access clearance approved. You should be able to get in starting Monday. Ask for David at the front desk.",
    createdAt: "2026-03-11T09:15:00Z",
  },
  {
    id: "cm-3",
    entityType: "milestone",
    entityId: "m-phase2",
    tenantId: "t-americold",
    authorId: "p-sarah",
    authorName: "Sarah Kim",
    authorAvatar: null,
    body: "Phase 2 is tracking well. We should be able to hit the April deadline if we can get the training session scheduled soon.",
    createdAt: "2026-03-12T16:45:00Z",
  },
];

// ─── Flagged Issues ─────────────────────────────────────────

export const MOCK_FLAGGED_ISSUES: FlaggedIssue[] = [
  {
    id: "fi-1",
    siteId: "s-denver",
    siteName: "Denver Distribution Center",
    tenantId: "t-americold",
    severity: "high",
    summary: "Zone A temperature spikes above threshold",
    details: "Sensors in Zone A-3 showing intermittent temperature spikes of +5°F above set point. Possible compressor cycling issue.",
    status: "open",
    flaggedBy: "p-mike",
    flaggedByName: "Mike Chen",
    createdAt: "2026-03-15T08:20:00Z",
  },
  {
    id: "fi-2",
    siteId: "s-atlanta",
    siteName: "Atlanta Cold Storage",
    tenantId: "t-americold",
    severity: "medium",
    summary: "Dock door sensor misalignment",
    details: "Loading dock #3 sensor reading consistently 2°F lower than manual thermometer. Needs recalibration.",
    status: "acknowledged",
    flaggedBy: "p-alex",
    flaggedByName: "Alex Rivera",
    createdAt: "2026-03-13T11:40:00Z",
  },
];

// ─── Helper: current user context (mock as CK admin) ────────

export const MOCK_CURRENT_USER: Profile = MOCK_PROFILES[1]!; // Sarah Kim, admin

export function getMockCurrentUser(): Profile {
  return MOCK_CURRENT_USER;
}

// ─── Query helpers ──────────────────────────────────────────

export function getCustomers(): Customer[] {
  return MOCK_CUSTOMERS;
}

export function getCustomerBySlug(slug: string): Customer | undefined {
  return MOCK_CUSTOMERS.find((c) => c.slug === slug);
}

export function getSitesForCustomer(customerSlug: string): Site[] {
  const customer = getCustomerBySlug(customerSlug);
  if (!customer) return [];
  return MOCK_SITES.filter((s) => s.customerId === customer.id);
}

export function getSiteBySlug(siteSlug: string): Site | undefined {
  return MOCK_SITES.find((s) => s.slug === siteSlug);
}

export function getMilestonesForSite(siteId: string): Milestone[] {
  return MOCK_MILESTONES.filter((m) => m.siteId === siteId);
}

export function getMilestoneBySlug(slug: string): Milestone | undefined {
  return MOCK_MILESTONES.find((m) => m.slug === slug);
}

export function getTasksForMilestone(milestoneId: string): Task[] {
  return MOCK_TASKS.filter((t) => t.milestoneId === milestoneId);
}

export function getCommentsForEntity(entityType: string, entityId: string): Comment[] {
  return MOCK_COMMENTS.filter((c) => c.entityType === entityType && c.entityId === entityId);
}

export function getFlaggedIssuesForCustomer(customerSlug: string): FlaggedIssue[] {
  const customer = getCustomerBySlug(customerSlug);
  if (!customer) return [];
  const siteIds = MOCK_SITES.filter((s) => s.customerId === customer.id).map((s) => s.id);
  return MOCK_FLAGGED_ISSUES.filter((fi) => siteIds.includes(fi.siteId));
}

export function getAllProfiles(): Profile[] {
  return MOCK_PROFILES;
}

export function getProfileById(id: string): Profile | undefined {
  return MOCK_PROFILES.find((p) => p.id === id);
}

// ─── Dashboard stats ────────────────────────────────────────

// ─── Voice Notes ─────────────────────────────────────────────

export const MOCK_VOICE_NOTES: VoiceNote[] = [
  {
    id: "vn-1",
    tenantId: "t-americold",
    title: "Denver site walkthrough notes",
    duration: 187,
    status: "ready",
    audioUrl: "/mock/audio/walkthrough.webm",
    recordedBy: "p-sarah",
    recordedByName: "Sarah Kim",
    siteId: "s-denver",
    siteName: "Denver Distribution Center",
    milestoneId: "m-phase2",
    milestoneName: "ATLAS Phase 2 Deployment",
    transcript:
      "Just finished the walkthrough of zones B through D at the Denver facility. Zone B sensor installation is complete, all 24 sensors are reading correctly. Zone C still needs the conduit run finished before we can mount sensors. I talked to Tom Bradley about the timeline, and he said facilities can have the conduit done by end of next week. Zone D is looking good, but we discovered a potential issue with the ammonia detection placement near the loading docks. We need to move two sensors further from the dock doors to avoid false positives from outside air. Action items: first, schedule the Zone C conduit work with Tom for next week. Second, update the sensor placement plan for Zone D loading dock area. Third, order two additional mounting brackets for the relocated sensors. Also, the team decided to push the training session to April 20th to make sure all zones are online first.",
    summary:
      "Site walkthrough at Denver facility covering Zones B-D. Zone B sensors fully installed and operational. Zone C awaiting conduit completion (expected next week). Zone D requires sensor relocation near loading docks to prevent false ammonia readings. Training session pushed to April 20th.",
    extractedTasks: [
      {
        id: "et-1",
        title: "Schedule Zone C conduit work with Tom Bradley",
        assigneeName: "Sarah Kim",
        dueDate: "2026-03-24",
        priority: "high",
        status: "pending",
      },
      {
        id: "et-2",
        title: "Update sensor placement plan for Zone D loading dock",
        assigneeName: "Mike Chen",
        dueDate: "2026-03-21",
        priority: "medium",
        status: "pending",
      },
      {
        id: "et-3",
        title: "Order two additional mounting brackets for relocated sensors",
        assigneeName: null,
        dueDate: "2026-03-20",
        priority: "low",
        status: "approved",
      },
    ],
    extractedDecisions: [
      "Push training session to April 20th to ensure all zones are online first",
      "Relocate two sensors at Zone D loading docks to avoid false positives",
    ],
    extractedUpdates: [
      "Zone B sensor installation complete - all 24 sensors reading correctly",
      "Zone C conduit run expected to be done by end of next week",
    ],
    errorMessage: null,
    createdAt: "2026-03-15T14:30:00Z",
  },
  {
    id: "vn-2",
    tenantId: "t-americold",
    title: "Weekly team sync recap",
    duration: 342,
    status: "transcribing",
    audioUrl: "/mock/audio/team-sync.webm",
    recordedBy: "p-jake",
    recordedByName: "Jake Dawson",
    siteId: null,
    siteName: null,
    milestoneId: null,
    milestoneName: null,
    transcript: null,
    summary: null,
    extractedTasks: [],
    extractedDecisions: [],
    extractedUpdates: [],
    errorMessage: null,
    createdAt: "2026-03-16T10:00:00Z",
  },
  {
    id: "vn-3",
    tenantId: "t-americold",
    title: "Atlanta compressor issue follow-up",
    duration: 95,
    status: "ready",
    audioUrl: "/mock/audio/compressor.webm",
    recordedBy: "p-alex",
    recordedByName: "Alex Rivera",
    siteId: "s-atlanta",
    siteName: "Atlanta Cold Storage",
    milestoneId: null,
    milestoneName: null,
    transcript:
      "Quick update on the Atlanta compressor situation. Spoke with the vendor and they confirmed the replacement parts will arrive Thursday. We should be able to do the swap over the weekend when dock traffic is lowest. No impact to cold chain expected during the repair window.",
    summary:
      "Compressor replacement parts arriving Thursday. Swap planned for weekend during low traffic. No cold chain impact expected.",
    extractedTasks: [
      {
        id: "et-4",
        title: "Coordinate weekend compressor swap with Atlanta facilities",
        assigneeName: "Alex Rivera",
        dueDate: "2026-03-22",
        priority: "high",
        status: "pending",
      },
    ],
    extractedDecisions: [
      "Schedule compressor swap for weekend to minimize dock traffic impact",
    ],
    extractedUpdates: [
      "Replacement parts confirmed arriving Thursday",
    ],
    errorMessage: null,
    createdAt: "2026-03-14T16:45:00Z",
  },
  {
    id: "vn-4",
    tenantId: "t-americold",
    title: "Sensor calibration discussion",
    duration: 63,
    status: "error",
    audioUrl: "/mock/audio/calibration.webm",
    recordedBy: "p-mike",
    recordedByName: "Mike Chen",
    siteId: "s-denver",
    siteName: "Denver Distribution Center",
    milestoneId: null,
    milestoneName: null,
    transcript: null,
    summary: null,
    extractedTasks: [],
    extractedDecisions: [],
    extractedUpdates: [],
    errorMessage: "Transcription failed: audio quality too low. Please re-record in a quieter environment.",
    createdAt: "2026-03-13T09:20:00Z",
  },
];

export function getVoiceNotes(): VoiceNote[] {
  return MOCK_VOICE_NOTES;
}

export function getVoiceNoteById(noteId: string): VoiceNote | undefined {
  return MOCK_VOICE_NOTES.find((vn) => vn.id === noteId);
}

// ─── Dashboard stats ────────────────────────────────────────

export function getDashboardStats() {
  const customers = MOCK_CUSTOMERS;
  const sites = MOCK_SITES;
  const tasks = MOCK_TASKS;
  const issues = MOCK_FLAGGED_ISSUES;

  return {
    totalCustomers: customers.length,
    totalSites: sites.length,
    activeSites: sites.filter((s) => s.pipelineStage === "active").length,
    inEvaluation: sites.filter((s) => s.pipelineStage === "evaluation").length,
    totalMilestones: MOCK_MILESTONES.length,
    activeMilestones: MOCK_MILESTONES.filter((m) => m.status === "in_progress").length,
    totalTasks: tasks.length,
    openTasks: tasks.filter((t) => t.status !== "done").length,
    openIssues: issues.filter((i) => i.status === "open").length,
  };
}

// ─── Status Reports ──────────────────────────────────────────

export type ReportStatus = "draft" | "generating" | "review" | "published";

export interface StatusReport {
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

export interface ReportSection {
  id: string;
  reportId: string;
  sectionType: "executive_summary" | "milestone_progress" | "task_summary" | "flagged_issues" | "next_steps";
  title: string;
  content: string;
  sortOrder: number;
}

export const MOCK_REPORTS: StatusReport[] = [
  {
    id: "rpt-1",
    tenantId: "t-americold",
    customerId: "c-americold",
    customerName: "Americold Realty Trust",
    siteId: "s-denver",
    siteName: "Denver Distribution Center",
    title: "Denver DC — March 2026 Status Report",
    slug: "rpt-denver-march-2026",
    status: "published",
    dateRangeStart: "2026-03-01",
    dateRangeEnd: "2026-03-15",
    createdBy: "p-sarah",
    createdByName: "Sarah Kim",
    publishedAt: "2026-03-16T10:00:00Z",
    createdAt: "2026-03-14T09:00:00Z",
    updatedAt: "2026-03-16T10:00:00Z",
  },
  {
    id: "rpt-2",
    tenantId: "t-americold",
    customerId: "c-americold",
    customerName: "Americold Realty Trust",
    siteId: "s-atlanta",
    siteName: "Atlanta Cold Storage",
    title: "Atlanta CS — March 2026 Update",
    slug: "rpt-atlanta-march-2026",
    status: "draft",
    dateRangeStart: "2026-03-01",
    dateRangeEnd: "2026-03-17",
    createdBy: "p-alex",
    createdByName: "Alex Rivera",
    publishedAt: null,
    createdAt: "2026-03-16T14:00:00Z",
    updatedAt: "2026-03-16T14:00:00Z",
  },
  {
    id: "rpt-3",
    tenantId: "t-lineage",
    customerId: "c-lineage",
    customerName: "Lineage Logistics",
    siteId: null,
    siteName: null,
    title: "Lineage — Q1 2026 Portfolio Review",
    slug: "rpt-lineage-q1-2026",
    status: "review",
    dateRangeStart: "2026-01-01",
    dateRangeEnd: "2026-03-15",
    createdBy: "p-sarah",
    createdByName: "Sarah Kim",
    publishedAt: null,
    createdAt: "2026-03-15T11:00:00Z",
    updatedAt: "2026-03-16T09:30:00Z",
  },
  {
    id: "rpt-4",
    tenantId: "t-americold",
    customerId: "c-americold",
    customerName: "Americold Realty Trust",
    siteId: "s-denver",
    siteName: "Denver Distribution Center",
    title: "Denver DC — February 2026 Status Report",
    slug: "rpt-denver-feb-2026",
    status: "published",
    dateRangeStart: "2026-02-01",
    dateRangeEnd: "2026-02-28",
    createdBy: "p-sarah",
    createdByName: "Sarah Kim",
    publishedAt: "2026-03-02T10:00:00Z",
    createdAt: "2026-02-28T09:00:00Z",
    updatedAt: "2026-03-02T10:00:00Z",
  },
];

export const MOCK_REPORT_SECTIONS: ReportSection[] = [
  {
    id: "rs-1",
    reportId: "rpt-1",
    sectionType: "executive_summary",
    title: "Executive Summary",
    content:
      "The Denver Distribution Center ATLAS deployment continues to progress well through March. Phase 2 sensor installation in Zone B is complete with all 24 sensors reading correctly. Zone C conduit work is scheduled for next week, and Zone D requires minor sensor relocation near loading docks. Overall project is tracking to the April 30 deadline.",
    sortOrder: 0,
  },
  {
    id: "rs-2",
    reportId: "rpt-1",
    sectionType: "milestone_progress",
    title: "Milestone Progress",
    content:
      "ATLAS Phase 2 Deployment: 65% complete. Zone B sensor installation finished ahead of schedule. Compressor Monitoring Upgrade: 100% complete as of January 10. Safety Compliance Review: 35% complete, documentation compilation underway. Energy Optimization Study: 10% complete, baseline audit pending.",
    sortOrder: 1,
  },
  {
    id: "rs-3",
    reportId: "rpt-1",
    sectionType: "task_summary",
    title: "Task Summary",
    content:
      "18 total tasks across 5 milestones. 12 completed, 3 in progress, 3 not started. Key completions this period: Zone B sensor array installation, historical data import validation. Upcoming: alerting threshold configuration (due March 15), safety documentation compilation (due March 20).",
    sortOrder: 2,
  },
  {
    id: "rs-4",
    reportId: "rpt-1",
    sectionType: "flagged_issues",
    title: "Flagged Issues",
    content:
      "One high-severity issue identified: Zone A temperature spikes above threshold detected by sensors in Zone A-3. Investigation suggests possible compressor cycling issue. Maintenance team has been notified and a diagnostic is scheduled for March 18.",
    sortOrder: 3,
  },
  {
    id: "rs-5",
    reportId: "rpt-1",
    sectionType: "next_steps",
    title: "Next Steps",
    content:
      "Complete Zone C conduit installation (week of March 23). Finalize Zone D sensor relocation plan. Configure alerting thresholds for Zone B sensors. Schedule operations team training session (targeting April 20). Begin energy audit baseline measurement.",
    sortOrder: 4,
  },
];

export function getReports(filter?: "all" | "draft" | "published"): StatusReport[] {
  if (!filter || filter === "all") return MOCK_REPORTS;
  if (filter === "draft") return MOCK_REPORTS.filter((r) => r.status === "draft");
  if (filter === "published") return MOCK_REPORTS.filter((r) => r.status === "published");
  return MOCK_REPORTS;
}

export function getReportById(reportId: string): StatusReport | undefined {
  return MOCK_REPORTS.find((r) => r.id === reportId);
}

export function getReportSections(reportId: string): ReportSection[] {
  return MOCK_REPORT_SECTIONS.filter((s) => s.reportId === reportId);
}

// ─── Notifications ───────────────────────────────────────────

export type NotificationType = "task_assigned" | "comment_added" | "report_published" | "issue_flagged" | "milestone_completed" | "user_joined";

export interface Notification {
  id: string;
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "n-1",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "issue_flagged",
    title: "New issue flagged",
    body: "Mike Chen flagged a high-severity issue at Denver Distribution Center: Zone A temperature spikes.",
    entityType: "flagged_issue",
    entityId: "fi-1",
    href: "/customers/americold/sites/denver-distribution-center",
    readAt: null,
    createdAt: "2026-03-15T08:20:00Z",
  },
  {
    id: "n-2",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "comment_added",
    title: "New comment on task",
    body: "Tom Bradley commented on \"Install sensor array in Zone B\": Access clearance approved.",
    entityType: "task",
    entityId: "t-sensor",
    href: "/customers/americold/sites/denver-distribution-center/milestones/atlas-phase-2-deployment",
    readAt: null,
    createdAt: "2026-03-11T09:15:00Z",
  },
  {
    id: "n-3",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "task_assigned",
    title: "Task assigned to you",
    body: "You were assigned \"Configure alerting thresholds\" on ATLAS Phase 2 Deployment.",
    entityType: "task",
    entityId: "t-alerting",
    href: "/customers/americold/sites/denver-distribution-center/milestones/atlas-phase-2-deployment",
    readAt: "2026-03-10T12:00:00Z",
    createdAt: "2026-03-10T10:00:00Z",
  },
  {
    id: "n-4",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "report_published",
    title: "Report published",
    body: "Denver DC — February 2026 Status Report has been published and shared with Americold.",
    entityType: "report",
    entityId: "rpt-4",
    href: "/reports/rpt-4",
    readAt: "2026-03-02T10:30:00Z",
    createdAt: "2026-03-02T10:00:00Z",
  },
  {
    id: "n-5",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "milestone_completed",
    title: "Milestone completed",
    body: "Compressor Monitoring Upgrade at Denver Distribution Center has been marked as complete.",
    entityType: "milestone",
    entityId: "m-compressor",
    href: "/customers/americold/sites/denver-distribution-center/milestones/compressor-monitoring-upgrade",
    readAt: "2026-01-10T16:00:00Z",
    createdAt: "2026-01-10T15:30:00Z",
  },
  {
    id: "n-6",
    tenantId: CK_TENANT.id,
    recipientId: "p-sarah",
    type: "user_joined",
    title: "New user request",
    body: "Hannah Sato (hannah@newcold.com) is requesting access to the NewCold portal.",
    entityType: "profile",
    entityId: "p-hannah",
    href: "/admin/users",
    readAt: null,
    createdAt: "2026-03-16T09:00:00Z",
  },
];

export function getNotifications(): Notification[] {
  return MOCK_NOTIFICATIONS;
}

export function getUnreadNotificationCount(): number {
  return MOCK_NOTIFICATIONS.filter((n) => n.readAt === null).length;
}

// ─── Search helper ───────────────────────────────────────────

export interface SearchResult {
  type: "site" | "milestone" | "task";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function searchAll(query: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  for (const site of MOCK_SITES) {
    if (
      site.name.toLowerCase().includes(q) ||
      site.city?.toLowerCase().includes(q) ||
      site.state?.toLowerCase().includes(q)
    ) {
      const customer = MOCK_CUSTOMERS.find((c) => c.id === site.customerId);
      results.push({
        type: "site",
        id: site.id,
        title: site.name,
        subtitle: customer?.name ?? "",
        href: `/customers/${customer?.slug}/sites/${site.slug}`,
      });
    }
  }

  for (const milestone of MOCK_MILESTONES) {
    if (
      milestone.name.toLowerCase().includes(q) ||
      milestone.description?.toLowerCase().includes(q)
    ) {
      const site = MOCK_SITES.find((s) => s.id === milestone.siteId);
      const customer = site ? MOCK_CUSTOMERS.find((c) => c.id === site.customerId) : undefined;
      results.push({
        type: "milestone",
        id: milestone.id,
        title: milestone.name,
        subtitle: site?.name ?? "",
        href: `/customers/${customer?.slug}/sites/${site?.slug}/milestones/${milestone.slug}`,
      });
    }
  }

  for (const task of MOCK_TASKS) {
    if (
      task.title.toLowerCase().includes(q) ||
      task.description?.toLowerCase().includes(q)
    ) {
      const milestone = MOCK_MILESTONES.find((m) => m.id === task.milestoneId);
      results.push({
        type: "task",
        id: task.id,
        title: task.title,
        subtitle: milestone?.name ?? "",
        href: "#",
      });
    }
  }

  return results.slice(0, 10);
}
