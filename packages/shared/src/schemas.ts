import { z } from "zod";
import {
  SITE_PIPELINE_STAGES,
  MILESTONE_STATUSES,
  TASK_STATUSES,
  TASK_SOURCES,
  PRIORITIES,
  ROLES,
  TENANT_TYPES,
  PROFILE_STATUSES,
  ATTACHMENT_TYPES,
  SEVERITY_LEVELS,
  ISSUE_STATUSES,
  NOTIFICATION_TYPES,
  ENTITY_TYPES,
  VOICE_NOTE_STATUSES,
  REPORT_STATUSES,
  REPORT_CADENCES,
  JOB_STATUSES,
} from "./constants";

// ─── Enums as Zod schemas ───────────────────────────────────────

export const sitePipelineStageSchema = z.enum(SITE_PIPELINE_STAGES);
export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskSourceSchema = z.enum(TASK_SOURCES);
export const prioritySchema = z.enum(PRIORITIES);
export const roleSchema = z.enum(ROLES);
export const tenantTypeSchema = z.enum(TENANT_TYPES);
export const profileStatusSchema = z.enum(PROFILE_STATUSES);
export const attachmentTypeSchema = z.enum(ATTACHMENT_TYPES);
export const severityLevelSchema = z.enum(SEVERITY_LEVELS);
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export const voiceNoteStatusSchema = z.enum(VOICE_NOTE_STATUSES);
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export const reportCadenceSchema = z.enum(REPORT_CADENCES);
export const jobStatusSchema = z.enum(JOB_STATUSES);

// ─── Helpers ────────────────────────────────────────────────────

/** Date string in YYYY-MM-DD format (matches PostgreSQL `date` type) */
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// ─── Form validation schemas ────────────────────────────────────
// Note: tenant_id, slug, and author/creator IDs are set server-side
// from the auth context — not submitted by the client.

export const createCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(255),
  domain: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().optional(),
});

export const createSiteSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(1, "Site name is required").max(255),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pipelineStage: sitePipelineStageSchema.default("prospect"),
  metadata: z.record(z.unknown()).optional(),
});

export const createMilestoneSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1, "Milestone name is required").max(255),
  description: z.string().max(2000).optional(),
  status: milestoneStatusSchema.default("not_started"),
  priority: prioritySchema.default("medium"),
  startDate: dateString.optional(),
  dueDate: dateString.optional(),
  templateId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createTaskSchema = z.object({
  milestoneId: z.string().uuid(),
  title: z.string().min(1, "Task title is required").max(255),
  description: z.string().max(2000).optional(),
  status: taskStatusSchema.default("todo"),
  priority: prioritySchema.default("medium"),
  assigneeId: z.string().uuid().optional(),
  dueDate: dateString.optional(),
  source: taskSourceSchema.default("manual"),
  metadata: z.record(z.unknown()).optional(),
});

export const createCommentSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  body: z.string().min(1, "Comment cannot be empty").max(5000),
  mentions: z.array(z.string().uuid()).optional(),
});

export const flagIssueSchema = z.object({
  siteId: z.string().uuid(),
  severity: severityLevelSchema,
  summary: z.string().min(1, "Summary is required").max(255),
  details: z.string().max(2000).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  tenantId: z.string().uuid(),
  role: roleSchema.default("member"),
  message: z.string().max(500).optional(),
});

export const updateSitePipelineStageSchema = z.object({
  siteId: z.string().uuid(),
  stage: sitePipelineStageSchema,
  dqReason: z.string().max(500).optional(),
  dqReevalDate: dateString.optional(),
});
