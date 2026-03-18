/** Site pipeline lifecycle stages in order */
export const SITE_PIPELINE_STAGES = [
  "prospect",
  "evaluation",
  "qualified",
  "disqualified",
  "contracted",
  "deployment",
  "active",
  "paused",
] as const;

export type SitePipelineStage = (typeof SITE_PIPELINE_STAGES)[number];

/** Milestone statuses */
export const MILESTONE_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "on_hold",
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** Task statuses */
export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Task priorities */
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type Priority = (typeof PRIORITIES)[number];

/** User roles — same 3 roles for both CK and customer tenants */
export const ROLES = ["super_admin", "admin", "member"] as const;

export type Role = (typeof ROLES)[number];

/** Tenant types */
export const TENANT_TYPES = ["internal", "customer"] as const;

export type TenantType = (typeof TENANT_TYPES)[number];

/** Profile statuses */
export const PROFILE_STATUSES = [
  "active",
  "pending",
  "pending_approval",
  "disabled",
] as const;

export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/** Attachment types */
export const ATTACHMENT_TYPES = [
  "document",
  "photo",
  "video",
  "audio",
] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

/** Flagged issue severity levels */
export const SEVERITY_LEVELS = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/** Flagged issue statuses */
export const ISSUE_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/** Notification types */
export const NOTIFICATION_TYPES = [
  "report_published",
  "task_assigned",
  "comment_mention",
  "milestone_completed",
  "approval_needed",
  "issue_flagged",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Entity types for polymorphic relations (comments, notifications, attachments, activity log) */
export const ENTITY_TYPES = [
  "site",
  "milestone",
  "task",
  "report",
  "issue",
  "customer",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** Voice note processing statuses */
export const VOICE_NOTE_STATUSES = [
  "uploading",
  "transcribing",
  "summarizing",
  "ready",
  "error",
] as const;

export type VoiceNoteStatus = (typeof VOICE_NOTE_STATUSES)[number];

/** Report statuses */
export const REPORT_STATUSES = [
  "draft",
  "generating",
  "review",
  "published",
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Report schedule cadences */
export const REPORT_CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
] as const;

export type ReportCadence = (typeof REPORT_CADENCES)[number];

/** Standardized ATLAS deployment lifecycle milestone templates */
export const ATLAS_MILESTONE_TEMPLATES = [
  { name: "Assessment", order: 1, description: "Initial site assessment and requirements gathering" },
  { name: "Installation", order: 2, description: "Hardware and sensor installation" },
  { name: "Calibration", order: 3, description: "System calibration and configuration" },
  { name: "Go-Live", order: 4, description: "Production deployment and handoff" },
  { name: "Optimization", order: 5, description: "Ongoing optimization and performance tuning" },
] as const;

/** Task source — how a task was created */
export const TASK_SOURCES = ["manual", "ai_extracted"] as const;

export type TaskSource = (typeof TASK_SOURCES)[number];

/** Job statuses for the background worker queue */
export const JOB_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

/** Well-known tenant IDs */
export const CK_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const UNASSIGNED_TENANT_ID = "00000000-0000-0000-0000-000000000000";

/** Job types for the background worker queue */
export const JOB_TYPES = [
  "transcribe",
  "summarize",
  "process_document",
  "generate_embeddings",
  "generate_report",
  "send_email",
  "send_notification",
] as const;

export type JobType = (typeof JOB_TYPES)[number];
