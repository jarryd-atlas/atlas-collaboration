import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

interface GCalAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
  optional?: boolean;
}

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: GCalAttendee[];
  organizer?: { email?: string };
  creator?: { email?: string };
  status?: string;
}

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

/**
 * POST /api/calendar/sync
 * Accepts Google Calendar events and syncs them to customer_meetings.
 * Matches attendee email domains to tenant domains.
 * Auto-creates stakeholders for new external contacts.
 */
export async function POST(req: NextRequest) {
  try {
    const { events } = (await req.json()) as { events: GCalEvent[] };

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "events array is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Load all tenants with domains
    const { data: tenants, error: tenantError } = await (supabase as any)
      .from("tenants")
      .select("id, name, domain")
      .not("domain", "is", null);

    if (tenantError) {
      console.error("Failed to load tenants:", tenantError);
      return NextResponse.json({ error: "Failed to load tenants" }, { status: 500 });
    }

    // Build domain → tenant map
    const domainToTenant = new Map<string, { id: string; name: string }>();
    for (const t of tenants || []) {
      if (t.domain && !CK_DOMAINS.includes(t.domain)) {
        domainToTenant.set(t.domain.toLowerCase(), { id: t.id, name: t.name });
      }
    }

    // Load customers keyed by tenant_id
    const tenantIds = [...domainToTenant.values()].map((t) => t.id);
    const { data: customers } = await (supabase as any)
      .from("customers")
      .select("id, name, tenant_id")
      .in("tenant_id", tenantIds);

    const tenantToCustomer = new Map<string, { id: string; name: string }>();
    for (const c of customers || []) {
      tenantToCustomer.set(c.tenant_id, { id: c.id, name: c.name });
    }

    // Load account plans for auto-stakeholder creation
    const customerIds = [...tenantToCustomer.values()].map((c) => c.id);
    const { data: plans } = await (supabase as any)
      .from("account_plans")
      .select("id, customer_id");

    const customerToAccountPlan = new Map<string, string>();
    for (const p of plans || []) {
      customerToAccountPlan.set(p.customer_id, p.id);
    }

    // Load existing stakeholders for deduplication
    const planIds = [...customerToAccountPlan.values()];
    const { data: existingStakeholders } = await (supabase as any)
      .from("account_stakeholders")
      .select("email, account_plan_id")
      .in("account_plan_id", planIds)
      .not("email", "is", null);

    const stakeholderEmails = new Set<string>();
    for (const s of existingStakeholders || []) {
      if (s.email) stakeholderEmails.add(s.email.toLowerCase());
    }

    let synced = 0;
    let customersMatched = new Set<string>();
    let stakeholdersAdded = 0;
    const newStakeholderEmails = new Set<string>(); // track within this sync to avoid dupes

    for (const event of events) {
      if (!event.id || !event.attendees || event.attendees.length === 0) continue;
      if (event.status === "cancelled") continue;

      // Separate attendees by domain
      const externalAttendees: Array<{ email: string; name: string; responseStatus: string }> = [];
      const ckAttendees: Array<{ email: string; name: string }> = [];

      // Track which customer domains are represented
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
          if (tenant) {
            matchedTenantIds.add(tenant.id);
          }
        }
      }

      // Skip events with no customer match
      if (matchedTenantIds.size === 0) continue;

      // Get meeting datetime
      const meetingDate = event.start?.dateTime || event.start?.date;
      const meetingEnd = event.end?.dateTime || event.end?.date;
      if (!meetingDate) continue;

      // Create a record for each matched customer
      for (const matchedTenantId of matchedTenantIds) {
        const customer = tenantToCustomer.get(matchedTenantId);
        if (!customer) continue;

        // Filter attendees to only those from this customer's domain
        const tenant = [...domainToTenant.entries()].find(([_, t]) => t.id === matchedTenantId);
        const customerDomain = tenant ? tenant[0] : "";

        const customerAttendees = externalAttendees.filter(
          (a) => getEmailDomain(a.email) === customerDomain
        );
        const otherAttendees = externalAttendees.filter(
          (a) => getEmailDomain(a.email) !== customerDomain && !isCKEmail(a.email)
        );

        // Upsert meeting
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
                .insert({
                  account_plan_id: accountPlanId,
                  tenant_id: matchedTenantId,
                  name: att.name,
                  email: emailLower,
                  is_ai_suggested: true,
                });

              if (!stakeErr) {
                stakeholdersAdded++;
                newStakeholderEmails.add(emailLower);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      synced,
      customers_matched: customersMatched.size,
      stakeholders_added: stakeholdersAdded,
      events_processed: events.length,
    });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync calendar events" },
      { status: 500 }
    );
  }
}
