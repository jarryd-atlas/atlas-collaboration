import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

/**
 * POST /api/calendar/sync-user
 * Fetches Google Calendar events for a user and syncs to customer_meetings.
 *
 * Uses Google Calendar incremental sync (syncToken) so that after the first
 * full fetch only changed / deleted events are returned, making periodic
 * polling cheap and near-real-time.
 *
 * Body: { userId: string }
 */

const CK_DOMAINS = ["crossnokaye.com"];

function getEmailDomain(email: string): string {
  return email.toLowerCase().split("@")[1] || "";
}

function isCKEmail(email: string): boolean {
  return CK_DOMAINS.some((d) => getEmailDomain(email) === d);
}

function nameFromEmail(email: string): string {
  const prefix = email.split("@")[0] || "";
  return prefix
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Exported helper so the cron endpoint can call it directly ──
export async function syncCalendarForUser(userId: string): Promise<{
  synced: number;
  deleted: number;
  customers_matched: number;
  stakeholders_added: number;
  events_fetched: number;
  error?: string;
}> {
  const supabase = createSupabaseAdmin();

  // 1. Get user's Google token
  const { data: tokenData } = await (supabase as any)
    .from("user_google_tokens")
    .select("access_token, refresh_token, expires_at, calendar_sync_token")
    .eq("user_id", userId)
    .single();

  if (!tokenData) {
    return { synced: 0, deleted: 0, customers_matched: 0, stakeholders_added: 0, events_fetched: 0, error: "No Google token — sign out and back in to grant calendar access" };
  }

  // Refresh token if expired
  let accessToken = tokenData.access_token as string;
  const expiresAt = new Date(tokenData.expires_at as string).getTime();
  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    if (!tokenData.refresh_token) {
      return { synced: 0, deleted: 0, customers_matched: 0, stakeholders_added: 0, events_fetched: 0, error: "Token expired, no refresh token" };
    }
    const refreshed = await refreshGoogleToken(tokenData.refresh_token as string);
    if (!refreshed) {
      return { synced: 0, deleted: 0, customers_matched: 0, stakeholders_added: 0, events_fetched: 0, error: "Failed to refresh token" };
    }
    accessToken = refreshed;
    await (supabase as any)
      .from("user_google_tokens")
      .update({
        access_token: accessToken,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  // 2. Fetch calendar events — incremental if we have a syncToken
  const existingSyncToken = tokenData.calendar_sync_token as string | null;
  let allEvents: any[] = [];
  let newSyncToken: string | null = null;
  let fullSync = false;

  try {
    if (existingSyncToken) {
      // Incremental sync — only changed/deleted events
      const result = await fetchEventsIncremental(accessToken, existingSyncToken);
      allEvents = result.events;
      newSyncToken = result.syncToken;
    } else {
      // First-time full sync
      fullSync = true;
      const result = await fetchEventsFull(accessToken);
      allEvents = result.events;
      newSyncToken = result.syncToken;
    }
  } catch (err: any) {
    if (err.status === 410) {
      // syncToken invalidated — do a full re-sync
      fullSync = true;
      const result = await fetchEventsFull(accessToken);
      allEvents = result.events;
      newSyncToken = result.syncToken;
    } else {
      return { synced: 0, deleted: 0, customers_matched: 0, stakeholders_added: 0, events_fetched: 0, error: err.message || "Failed to fetch calendar events" };
    }
  }

  // Persist the new syncToken for next incremental call
  if (newSyncToken) {
    await (supabase as any)
      .from("user_google_tokens")
      .update({
        calendar_sync_token: newSyncToken,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  // 3. Load tenant/customer mappings
  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("id, name, domain")
    .not("domain", "is", null);

  const domainToTenant = new Map<string, { id: string; name: string }>();
  for (const t of tenants || []) {
    if (t.domain && !CK_DOMAINS.includes(t.domain)) {
      domainToTenant.set(t.domain.toLowerCase(), { id: t.id, name: t.name });
    }
  }

  const tenantIds = [...domainToTenant.values()].map((t) => t.id);
  const { data: customers } = await (supabase as any)
    .from("customers")
    .select("id, name, tenant_id")
    .in("tenant_id", tenantIds);

  const tenantToCustomer = new Map<string, { id: string; name: string }>();
  for (const c of customers || []) {
    tenantToCustomer.set(c.tenant_id, { id: c.id, name: c.name });
  }

  // Load account plans for stakeholder creation
  const { data: plans } = await (supabase as any)
    .from("account_plans")
    .select("id, customer_id");

  const customerToAccountPlan = new Map<string, string>();
  for (const p of plans || []) {
    customerToAccountPlan.set(p.customer_id, p.id);
  }

  // Load existing stakeholders
  const planIds = [...customerToAccountPlan.values()];
  const { data: existingStakeholders } = await (supabase as any)
    .from("account_stakeholders")
    .select("email, account_plan_id")
    .in("account_plan_id", planIds.length > 0 ? planIds : ["__none__"])
    .not("email", "is", null);

  const stakeholderEmails = new Set<string>();
  for (const s of existingStakeholders || []) {
    if (s.email) stakeholderEmails.add(s.email.toLowerCase());
  }

  // 4. Process events
  let synced = 0;
  let deleted = 0;
  const customersMatched = new Set<string>();
  let stakeholdersAdded = 0;
  const newStakeholderEmails = new Set<string>();

  for (const event of allEvents) {
    if (!event.id) continue;

    // Handle cancelled/deleted events — remove from customer_meetings
    if (event.status === "cancelled") {
      const { data: removedRows } = await (supabase as any)
        .from("customer_meetings")
        .delete()
        .eq("google_event_id", event.id)
        .select("id");
      deleted += (removedRows?.length ?? 0);
      continue;
    }

    // Skip events with no attendees (no way to match to a customer)
    if (!event.attendees || event.attendees.length === 0) continue;

    const externalAttendees: Array<{ email: string; name: string; responseStatus: string }> = [];
    const ckAttendees: Array<{ email: string; name: string }> = [];
    const matchedTenantIds = new Set<string>();

    for (const att of event.attendees) {
      if (!att.email) continue;
      const email = att.email.toLowerCase();
      const domain = getEmailDomain(email);

      if (isCKEmail(email)) {
        ckAttendees.push({
          email,
          name: att.displayName || nameFromEmail(email),
        });
      } else {
        externalAttendees.push({
          email,
          name: att.displayName || nameFromEmail(email),
          responseStatus: att.responseStatus || "needsAction",
        });
        const tenant = domainToTenant.get(domain);
        if (tenant) matchedTenantIds.add(tenant.id);
      }
    }

    if (matchedTenantIds.size === 0) continue;

    const meetingDate = event.start?.dateTime || event.start?.date;
    const meetingEnd = event.end?.dateTime || event.end?.date;
    if (!meetingDate) continue;

    for (const matchedTenantId of matchedTenantIds) {
      const customer = tenantToCustomer.get(matchedTenantId);
      if (!customer) continue;

      const tenant = [...domainToTenant.entries()].find(([_, t]) => t.id === matchedTenantId);
      const customerDomain = tenant ? tenant[0] : "";

      const customerAttendees = externalAttendees.filter(
        (a) => getEmailDomain(a.email) === customerDomain
      );
      const otherAttendees = externalAttendees.filter(
        (a) => getEmailDomain(a.email) !== customerDomain && !isCKEmail(a.email)
      );

      const { error: upsertError } = await (supabase as any)
        .from("customer_meetings")
        .upsert(
          {
            customer_id: customer.id,
            tenant_id: matchedTenantId,
            google_event_id: event.id,
            title: event.summary || "Untitled Meeting",
            description: event.description?.substring(0, 2000) || null,
            meeting_date: meetingDate,
            meeting_end: meetingEnd || null,
            location: event.location || null,
            html_link: event.htmlLink || null,
            organizer_email: event.organizer?.email || event.creator?.email || null,
            attendees: [...customerAttendees, ...otherAttendees],
            ck_attendees: ckAttendees,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "google_event_id" }
        );

      if (upsertError) {
        console.error(`Failed to upsert meeting ${event.id}:`, upsertError.message);
        continue;
      }

      synced++;
      customersMatched.add(customer.id);

      // Auto-add stakeholders
      const accountPlanId = customerToAccountPlan.get(customer.id);
      if (accountPlanId) {
        for (const att of customerAttendees) {
          const emailLower = att.email.toLowerCase();
          if (
            !stakeholderEmails.has(emailLower) &&
            !newStakeholderEmails.has(emailLower)
          ) {
            const { error: stakeErr } = await (supabase as any)
              .from("account_stakeholders")
              .upsert({
                account_plan_id: accountPlanId,
                tenant_id: matchedTenantId,
                name: att.name,
                email: emailLower,
                is_ai_suggested: true,
              }, { onConflict: "account_plan_id,email", ignoreDuplicates: true });

            if (!stakeErr) {
              stakeholdersAdded++;
              newStakeholderEmails.add(emailLower);
            }
          }
        }
      }
    }
  }

  return {
    synced,
    deleted,
    customers_matched: customersMatched.size,
    stakeholders_added: stakeholdersAdded,
    events_fetched: allEvents.length,
  };
}

// ── Google Calendar API helpers ──

async function fetchEventsFull(accessToken: string): Promise<{ events: any[]; syncToken: string | null }> {
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const allEvents: any[] = [];
  let pageToken: string | undefined;
  let syncToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: "250",
      singleEvents: "true",
      orderBy: "startTime",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google Calendar API error (full):", res.status, errText);
      const err: any = new Error("Failed to fetch calendar events");
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) syncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: allEvents, syncToken };
}

async function fetchEventsIncremental(accessToken: string, syncToken: string): Promise<{ events: any[]; syncToken: string | null }> {
  const allEvents: any[] = [];
  let pageToken: string | undefined;
  let newSyncToken: string | null = null;

  do {
    const params = new URLSearchParams({
      syncToken,
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google Calendar API error (incremental):", res.status, errText);
      const err: any = new Error("Failed to fetch calendar events");
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events: allEvents, syncToken: newSyncToken };
}

// ── HTTP handler ──

export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as { userId: string };
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const result = await syncCalendarForUser(userId);

    if (result.error) {
      const status = result.error.includes("No Google token") ? 404
        : result.error.includes("Token expired") || result.error.includes("refresh") ? 401
        : 502;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Calendar sync-user error:", err);
    return NextResponse.json({ error: "Failed to sync calendar" }, { status: 500 });
  }
}
