import type { Role, TenantType } from "./constants";

export interface UserContext {
  role: Role;
  tenantType: TenantType;
  tenantId: string;
  userId: string;
}

// ─── Role checks ────────────────────────────────────────────────

/** Check if user is a CK internal team member */
export function isInternal(ctx: UserContext): boolean {
  return ctx.tenantType === "internal";
}

/** Check if user is a customer user */
export function isCustomer(ctx: UserContext): boolean {
  return ctx.tenantType === "customer";
}

/** Check if user has super_admin role (CK only) */
export function isSuperAdmin(ctx: UserContext): boolean {
  return ctx.role === "super_admin" && isInternal(ctx);
}

/** Check if user has admin+ role (any tenant type) */
export function isAdmin(ctx: UserContext): boolean {
  return ctx.role === "admin" || ctx.role === "super_admin";
}

/** CK admin — can manage all customers, full CRUD */
export function isCKAdmin(ctx: UserContext): boolean {
  return isInternal(ctx) && isAdmin(ctx);
}

/** Customer admin — can invite/manage users in their own org */
export function isCustomerAdmin(ctx: UserContext): boolean {
  return isCustomer(ctx) && ctx.role === "admin";
}

// ─── Entity management ──────────────────────────────────────────

/** Can this user create sites, milestones, tasks? (CK admin+) */
export function canCreateEntities(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user edit entities? CK admin can edit all; CK member can edit assigned items */
export function canEditEntity(ctx: UserContext, assigneeId?: string): boolean {
  if (isCKAdmin(ctx)) return true;
  if (isInternal(ctx) && ctx.role === "member" && assigneeId === ctx.userId) return true;
  return false;
}

/** Can this user delete entities? (CK admin+ only) */
export function canDeleteEntities(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user manage pipeline stages? (CK admin+) */
export function canManagePipeline(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

// ─── User management ────────────────────────────────────────────

/** Can this user invite users? */
export function canInviteUsers(ctx: UserContext): boolean {
  return isCKAdmin(ctx) || isCustomerAdmin(ctx);
}

/** Can this user approve pending users? (CK admin+) */
export function canApproveUsers(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user promote customer users to admin? (CK admin+) */
export function canPromoteCustomerUsers(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user access the admin panel? (CK admin+) */
export function canAccessAdmin(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

// ─── Task-specific permissions ──────────────────────────────────

/** Can this user create tasks? All authenticated users can. */
export function canCreateTasks(_ctx: UserContext): boolean {
  return true;
}

/** Can this user edit a task? CK admin always; CK member if assigned; customer users for tasks in their tenant */
export function canEditTask(
  ctx: UserContext,
  task: { assignee_id?: string | null; created_by?: string | null; tenant_id: string },
): boolean {
  if (isCKAdmin(ctx)) return true;
  if (isInternal(ctx) && ctx.role === "member" && task.assignee_id === ctx.userId) return true;
  // Customer users can edit tasks in their tenant
  if (isCustomer(ctx) && task.tenant_id === ctx.tenantId) return true;
  return false;
}

/** Can this user manage CK team assignments for customers? (CK admin+) */
export function canManageCustomerTeam(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user manage site access restrictions? (CK admin+) */
export function canManageSiteAccess(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

// ─── Collaboration ──────────────────────────────────────────────

/** Can this user comment on entities? (all authenticated users) */
export function canComment(_ctx: UserContext): boolean {
  return true;
}

/** Can this user upload attachments? (all authenticated users) */
export function canUploadAttachments(_ctx: UserContext): boolean {
  return true;
}

// ─── CK-only features ──────────────────────────────────────────

/** Can this user record voice notes? (CK only) */
export function canRecordVoiceNotes(ctx: UserContext): boolean {
  return isInternal(ctx);
}

/** Can this user flag issues? (CK only) */
export function canFlagIssues(ctx: UserContext): boolean {
  return isInternal(ctx);
}

/** Can this user resolve flagged issues? (CK admin+) */
export function canResolveIssues(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

// ─── Reports ────────────────────────────────────────────────────

/** Can this user create/edit reports? (CK admin+) */
export function canManageReports(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

/** Can this user manage report schedules? (CK admin+) */
export function canManageSchedules(ctx: UserContext): boolean {
  return isCKAdmin(ctx);
}

// ─── Visibility ─────────────────────────────────────────────────

/** Can this user see all customers? (CK internal) */
export function canViewAllCustomers(ctx: UserContext): boolean {
  return isInternal(ctx);
}
