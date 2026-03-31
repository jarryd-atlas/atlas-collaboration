"use server";

import { createSupabaseAdmin, requireSession } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

export interface CustomerEmail {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  body_plain: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: Array<{ email: string; name: string }>;
  cc_emails: Array<{ email: string; name: string }>;
  date: string;
  direction: "inbound" | "outbound";
  ck_user_id: string | null;
  ck_user_email: string | null;
  synced_at: string;
}

export interface EmailDigest {
  id: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  email_count: number;
  narrative: string;
  key_topics: string[];
  key_contacts: Array<{ name: string; email: string; direction: string; count: number; lastDate: string }>;
  action_items: string[];
  sentiment: string | null;
  momentum: string | null;
  generated_at: string;
}

export async function fetchCustomerEmails(
  customerId: string,
  options?: {
    limit?: number;
    offset?: number;
    teamMemberId?: string;
    threadId?: string;
  }
): Promise<{ emails: CustomerEmail[]; error?: string }> {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { emails: [], error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    let query = fromTable(admin, "customer_emails")
      .select("id, gmail_message_id, gmail_thread_id, subject, snippet, body_plain, from_email, from_name, to_emails, cc_emails, date, direction, ck_user_id, ck_user_email, synced_at")
      .eq("customer_id", customerId)
      .order("date", { ascending: false });

    if (options?.teamMemberId) {
      query = query.eq("ck_user_id", options.teamMemberId);
    }
    if (options?.threadId) {
      query = query.eq("gmail_thread_id", options.threadId);
    }

    const limit = options?.limit ?? 200;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { emails: [], error: error.message };

    return { emails: (data ?? []) as CustomerEmail[] };
  } catch (err) {
    return { emails: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function fetchEmailDigest(
  customerId: string
): Promise<{ digest: EmailDigest | null; error?: string }> {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { digest: null, error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await fromTable(admin, "customer_email_digests")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) return { digest: null, error: error.message };
    return { digest: data as EmailDigest | null };
  } catch (err) {
    return { digest: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getEmailSyncStatus(customerId: string): Promise<{
  lastSyncAt: string | null;
  totalEmails: number;
  uniqueThreads: number;
  teamMembers: Array<{ email: string; count: number }>;
}> {
  try {
    const admin = createSupabaseAdmin();

    const { data: emails } = await fromTable(admin, "customer_emails")
      .select("ck_user_email, gmail_thread_id, synced_at")
      .eq("customer_id", customerId);

    if (!emails || emails.length === 0) {
      return { lastSyncAt: null, totalEmails: 0, uniqueThreads: 0, teamMembers: [] };
    }

    const threads = new Set<string>();
    const memberCounts = new Map<string, number>();
    let lastSyncAt: string | null = null;

    for (const e of emails as { ck_user_email: string; gmail_thread_id: string; synced_at: string }[]) {
      threads.add(e.gmail_thread_id);
      memberCounts.set(e.ck_user_email, (memberCounts.get(e.ck_user_email) ?? 0) + 1);
      if (!lastSyncAt || e.synced_at > lastSyncAt) lastSyncAt = e.synced_at;
    }

    const teamMembers = [...memberCounts.entries()]
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count);

    return {
      lastSyncAt,
      totalEmails: emails.length,
      uniqueThreads: threads.size,
      teamMembers,
    };
  } catch {
    return { lastSyncAt: null, totalEmails: 0, uniqueThreads: 0, teamMembers: [] };
  }
}
