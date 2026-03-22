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
  "customer", // DB column name remains "customer" for backwards compat
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

/** Company types — whether a company is a customer or prospect */
export const COMPANY_TYPES = ["customer", "prospect"] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];

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
  "extract_document",
  "analyze_savings",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

// ═══════════════════════════════════════════════════════════════
// Site Assessment Constants
// ═══════════════════════════════════════════════════════════════

/** Equipment categories for refrigeration systems */
export const EQUIPMENT_CATEGORIES = [
  "compressor", "condenser", "evaporator", "vessel", "vfd", "pump", "controls", "other",
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/** Equipment category display labels */
export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  compressor: "Compressors",
  condenser: "Condensers",
  evaporator: "Evaporators",
  vessel: "Vessels",
  vfd: "VFDs",
  pump: "Pumps",
  controls: "Controls",
  other: "Other",
};

/** Compressor types */
export const COMPRESSOR_TYPES = ["screw", "reciprocating", "rotary"] as const;
export type CompressorType = (typeof COMPRESSOR_TYPES)[number];

/** Condenser types */
export const CONDENSER_TYPES = ["evaporative", "air_cooled"] as const;
export type CondenserType = (typeof CONDENSER_TYPES)[number];

/** Evaporator types */
export const EVAPORATOR_TYPES = ["unit_cooler", "pencoil", "plate"] as const;
export type EvaporatorType = (typeof EVAPORATOR_TYPES)[number];

/** Vessel types */
export const VESSEL_TYPES = ["receiver", "intercooler", "accumulator", "economizer"] as const;
export type VesselType = (typeof VESSEL_TYPES)[number];

/** Defrost types */
export const DEFROST_TYPES = ["electric", "hot_gas", "air", "none"] as const;
export type DefrostType = (typeof DEFROST_TYPES)[number];

/** Refrigeration loop types */
export const REFRIGERATION_LOOPS = ["low", "high", "blast"] as const;
export type RefrigerationLoop = (typeof REFRIGERATION_LOOPS)[number];

/** Assessment statuses */
export const ASSESSMENT_STATUSES = ["draft", "in_progress", "complete", "locked"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/** Site assessment tab keys */
export const SITE_ASSESSMENT_TABS = ["overview", "baseline", "labor"] as const;
export type SiteAssessmentTab = (typeof SITE_ASSESSMENT_TABS)[number];

/** Tab display labels */
export const SITE_ASSESSMENT_TAB_LABELS: Record<SiteAssessmentTab, string> = {
  overview: "Overview",
  baseline: "Baseline",
  labor: "Labor",
};

/** Energy AI savings opportunity types */
export const SAVINGS_OPPORTUNITY_TYPES = [
  "refrigeration_efficiency",
  "demand_stabilization",
  "rate_arbitrage",
  "coincident_peak_avoidance",
  "blast_optimization",
] as const;
export type SavingsOpportunityType = (typeof SAVINGS_OPPORTUNITY_TYPES)[number];

/** Savings opportunity display labels */
export const SAVINGS_OPPORTUNITY_LABELS: Record<SavingsOpportunityType, string> = {
  refrigeration_efficiency: "Refrigeration Efficiency",
  demand_stabilization: "Demand Stabilization",
  rate_arbitrage: "Rate Arbitrage",
  coincident_peak_avoidance: "Coincident Peak Avoidance",
  blast_optimization: "Blast Optimization",
};

/** Common refrigerants */
export const REFRIGERANTS = ["ammonia", "R-22", "R-404A", "R-507", "CO2", "R-134a"] as const;

/** Facility types */
export const FACILITY_TYPES = ["cold_storage", "processing", "distribution", "mixed"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

/** System types */
export const SYSTEM_TYPES = ["single_stage", "two_stage", "cascade"] as const;
export type SystemType = (typeof SYSTEM_TYPES)[number];

/** HP to kW conversion factor */
export const HP_TO_KW = 0.7457;

/** Labor roles for baseline tracking */
export const LABOR_ROLES = [
  "refrigeration_engineer",
  "operator",
  "maintenance_tech",
  "contractor",
  "supervisor",
  "other",
] as const;
export type LaborRole = (typeof LABOR_ROLES)[number];

/** Labor role display labels */
export const LABOR_ROLE_LABELS: Record<LaborRole, string> = {
  refrigeration_engineer: "Refrigeration Engineer",
  operator: "Operator",
  maintenance_tech: "Maintenance Technician",
  contractor: "Contractor",
  supervisor: "Supervisor",
  other: "Other",
};

/** Baseline sections for collapsible layout */
export const BASELINE_SECTIONS = ["equipment", "energy", "operations", "savings"] as const;
export type BaselineSection = (typeof BASELINE_SECTIONS)[number];
