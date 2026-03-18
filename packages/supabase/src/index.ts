export { createBrowserClient, createServerClient } from "./clients.js";
export type { Database, Json } from "./types.js";

// ─── Convenience type aliases for Supabase enums ─────────────
// These map the generated Database enum types to friendly names
// used throughout the app code and server actions.

import type { Database as DB } from "./types.js";

export type TenantType = DB["public"]["Enums"]["tenant_type"];
export type UserRole = DB["public"]["Enums"]["user_role"];
export type ProfileStatus = DB["public"]["Enums"]["profile_status"];
export type PipelineStage = DB["public"]["Enums"]["pipeline_stage"];
export type MilestoneStatus = DB["public"]["Enums"]["milestone_status"];
export type TaskStatus = DB["public"]["Enums"]["task_status"];
export type PriorityLevel = DB["public"]["Enums"]["priority_level"];
export type AttachmentType = DB["public"]["Enums"]["attachment_type"];
export type EntityType = DB["public"]["Enums"]["entity_type"];
export type SeverityLevel = DB["public"]["Enums"]["severity_level"];
export type IssueStatus = DB["public"]["Enums"]["issue_status"];
export type NotificationType = DB["public"]["Enums"]["notification_type"];
export type VoiceNoteStatus = DB["public"]["Enums"]["voice_note_status"];
export type ReportStatus = DB["public"]["Enums"]["report_status"];
export type ReportCadence = DB["public"]["Enums"]["report_cadence"];
export type TaskSource = DB["public"]["Enums"]["task_source"];
export type JobStatus = DB["public"]["Enums"]["job_status"];

// ─── Convenience type aliases for table rows ─────────────────
export type TenantRow = DB["public"]["Tables"]["tenants"]["Row"];
export type ProfileRow = DB["public"]["Tables"]["profiles"]["Row"];
export type CustomerRow = DB["public"]["Tables"]["customers"]["Row"];
export type SiteRow = DB["public"]["Tables"]["sites"]["Row"];
export type MilestoneRow = DB["public"]["Tables"]["milestones"]["Row"];
export type TaskRow = DB["public"]["Tables"]["tasks"]["Row"];
export type CommentRow = DB["public"]["Tables"]["comments"]["Row"];
export type FlaggedIssueRow = DB["public"]["Tables"]["flagged_issues"]["Row"];
export type NotificationRow = DB["public"]["Tables"]["notifications"]["Row"];
export type StatusReportRow = DB["public"]["Tables"]["status_reports"]["Row"];
export type ReportSectionRow = DB["public"]["Tables"]["report_sections"]["Row"];
export type AttachmentRow = DB["public"]["Tables"]["attachments"]["Row"];
export type VoiceNoteRow = DB["public"]["Tables"]["voice_notes"]["Row"];
export type ActivityLogRow = DB["public"]["Tables"]["activity_log"]["Row"];
