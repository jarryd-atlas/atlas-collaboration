/**
 * Data queries for the Account 360 meeting dashboard.
 *
 * Returns a snapshot of the customer: open HubSpot deals + pipeline $,
 * active sites with pipeline_stage, key stakeholders, momentum, open tasks.
 *
 * Uses the service-role admin client to bypass RLS (same pattern as
 * meeting-queries.ts). Callers must already have authenticated the user as
 * internal before invoking these helpers.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { getStandupDealData, type StandupDeal } from "./meeting-queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

export interface Account360Stakeholder {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  department: string | null;
  stakeholder_role: string | null;
}

export interface Account360Site {
  id: string;
  name: string;
  pipeline_stage: string | null;
  next_step: string | null;
}

export interface Account360Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
  site_name: string | null;
}

export interface Account360Snapshot {
  customer: { id: string; name: string; slug: string };
  deals: StandupDeal[];
  dealTotalAmount: number;
  sites: Account360Site[];
  stakeholders: Account360Stakeholder[];
  momentum: "accelerating" | "steady" | "slowing" | "stalled" | null;
  momentumNarrative: string | null;
  openTasks: Account360Task[];
}

/**
 * Build the Account 360 snapshot for a specific customer.
 */
export async function getAccount360Snapshot(
  customerId: string,
): Promise<Account360Snapshot | null> {
  const supabase = createSupabaseAdmin();

  // Customer basics
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, slug")
    .eq("id", customerId)
    .single();

  if (!customer) return null;

  // Run independent queries in parallel.
  const [sitesRes, stakeholdersData, digestRes, tasksRes, dealDataMap] = await Promise.all([
    // Sites
    supabase
      .from("sites")
      .select("id, name, pipeline_stage, next_step")
      .eq("customer_id", customerId)
      .order("name"),

    // Stakeholders (via account_plans → account_stakeholders)
    (async () => {
      const { data: plans } = await fromTable(supabase, "account_plans")
        .select("id")
        .eq("customer_id", customerId);
      if (!plans || plans.length === 0) return [] as Account360Stakeholder[];
      const planIds = (plans as any[]).map((p) => p.id);
      const { data: stakeholders } = await fromTable(supabase, "account_stakeholders")
        .select("id, name, email, title, department, stakeholder_role")
        .in("account_plan_id", planIds);
      return (stakeholders ?? []) as Account360Stakeholder[];
    })(),

    // Latest email digest → momentum
    (supabase as any)
      .from("customer_email_digests")
      .select("momentum, narrative")
      .eq("customer_id", customerId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Open tasks for this customer
    supabase
      .from("tasks")
      .select("id, title, status, due_date, site_id, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)")
      .eq("customer_id", customerId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(20),

    // Deals: reuse the standup deal fetcher (groups deals by customer_id).
    // Non-critical — returns {} on failure.
    getStandupDealData().catch(() => ({} as Record<string, StandupDeal[]>)),
  ]);

  const sites: Account360Site[] = ((sitesRes.data ?? []) as any[]).map((s) => ({
    id: s.id,
    name: s.name,
    pipeline_stage: s.pipeline_stage ?? null,
    next_step: s.next_step ?? null,
  }));

  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));

  const openTasks: Account360Task[] = ((tasksRes.data ?? []) as any[]).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    due_date: t.due_date ?? null,
    assignee: t.assignee
      ? {
          id: t.assignee.id,
          full_name: t.assignee.full_name,
          avatar_url: t.assignee.avatar_url,
        }
      : null,
    site_name: t.site_id ? siteNameById.get(t.site_id) ?? null : null,
  }));

  const deals = (dealDataMap as Record<string, StandupDeal[]>)[customerId] ?? [];
  const dealTotalAmount = deals.reduce((sum, d) => {
    const n = d.amount ? Number(d.amount) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const digestData = (digestRes as any)?.data ?? null;

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      slug: (customer as any).slug,
    },
    deals,
    dealTotalAmount,
    sites,
    stakeholders: stakeholdersData,
    momentum: digestData?.momentum ?? null,
    momentumNarrative: digestData?.narrative ?? null,
    openTasks,
  };
}
