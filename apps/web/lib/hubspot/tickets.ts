/**
 * HubSpot Ticket Sync — domain-based matching to customers.
 *
 * Uses: search API (date-filtered) → batch associations → batch contacts → domain match → upsert.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { batchReadContacts } from "./client";

const BASE_URL = "https://api.hubapi.com";

export interface TicketSyncResult {
  ticketsSynced: number;
  ticketsFetched: number;
  customersMatched: number;
  errors: string[];
}

/** Search tickets with date filter (paginated) */
async function searchTickets(
  token: string,
  properties: string[],
  createdAfterMs: number,
  after?: string
): Promise<{
  results: Array<{ id: string; properties: Record<string, string | null> }>;
  total: number;
  paging?: { next?: { after: string } };
}> {
  const res = await fetch(`${BASE_URL}/crm/v3/objects/tickets/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "createdate",
              operator: "GTE",
              value: createdAfterMs.toString(),
            },
          ],
        },
      ],
      properties,
      sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot search error ${res.status}: ${body.substring(0, 200)}`);
  }

  return res.json();
}

/** Batch-read ticket→contact associations via v4 API */
async function batchGetTicketContactAssociations(
  token: string,
  ticketIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (ticketIds.length === 0) return result;

  // Batch in groups of 100
  for (let i = 0; i < ticketIds.length; i += 100) {
    const batch = ticketIds.slice(i, i + 100);
    const res = await fetch(
      `${BASE_URL}/crm/v4/associations/tickets/contacts/batch/read`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: batch.map((id) => ({ id })),
        }),
      }
    );

    if (!res.ok) continue; // Skip batch on error, don't block sync

    const data = await res.json();
    for (const item of data.results || []) {
      const contactIds = (item.to || []).map((t: any) => String(t.toObjectId));
      result.set(String(item.from.id), contactIds);
    }
  }

  return result;
}

/**
 * Sync HubSpot tickets to customer_tickets table.
 * Matches tickets to customers via associated contact email domains.
 *
 * @param customerId - If provided, only sync tickets matching this customer. Otherwise sync all.
 */
export async function syncHubSpotTickets(customerId?: string): Promise<TicketSyncResult> {
  const supabase = createSupabaseAdmin();
  const errors: string[] = [];

  // 1. Load first active HubSpot config
  const { data: config, error: configErr } = await (supabase as any)
    .from("hubspot_config")
    .select("access_token, portal_id, is_active")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (configErr || !config) {
    return { ticketsSynced: 0, ticketsFetched: 0, customersMatched: 0, errors: ["HubSpot not configured or inactive"] };
  }

  const token = config.access_token as string;

  // 2. Build domain → customer map
  const { data: tenants } = await (supabase as any)
    .from("tenants")
    .select("id, name, domain")
    .not("domain", "is", null);

  const tenantIds = (tenants || []).map((t: any) => t.id);
  let customersQuery = (supabase as any)
    .from("customers")
    .select("id, tenant_id, name")
    .in("tenant_id", tenantIds);
  if (customerId) {
    customersQuery = customersQuery.eq("id", customerId);
  }
  const { data: customers } = await customersQuery;

  const domainToCustomer = new Map<string, { customerId: string; tenantId: string }>();
  for (const tenant of (tenants || []) as any[]) {
    if (!tenant.domain) continue;
    const domain = tenant.domain.replace(/^@/, "").toLowerCase();
    const customer = (customers || []).find((c: any) => c.tenant_id === tenant.id);
    if (customer) {
      domainToCustomer.set(domain, { customerId: customer.id, tenantId: tenant.id });
    }
  }

  // Also match on CK internal domain — tickets may have CK contacts only
  // We want to match those too if the ticket content mentions customer domains
  // For now, skip CK-only tickets (they need a customer contact to match)

  if (domainToCustomer.size === 0) {
    return { ticketsSynced: 0, ticketsFetched: 0, customersMatched: 0, errors: ["No customer domains configured"] };
  }

  // 3. Search tickets from last 90 days (paginated, sorted by createdate DESC)
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const ticketProperties = [
    "subject",
    "content",
    "hs_ticket_priority",
    "hs_pipeline",
    "hs_pipeline_stage",
    "createdate",
    "hs_lastmodifieddate",
    "closed_date",
    "source_type",
    "hubspot_owner_id",
  ];

  let allTickets: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  try {
    do {
      const result = await searchTickets(token, ticketProperties, ninetyDaysAgo, after);
      allTickets = allTickets.concat(result.results);
      after = result.paging?.next?.after;
    } while (after);
  } catch (err) {
    errors.push(`Failed to fetch tickets: ${err instanceof Error ? err.message : String(err)}`);
    return { ticketsSynced: 0, ticketsFetched: 0, customersMatched: 0, errors };
  }

  if (allTickets.length === 0) {
    return { ticketsSynced: 0, ticketsFetched: 0, customersMatched: 0, errors: [] };
  }

  // 4. Batch-fetch ticket→contact associations
  const ticketIds = allTickets.map((t) => t.id);
  let ticketContactMap: Map<string, string[]>;
  try {
    ticketContactMap = await batchGetTicketContactAssociations(token, ticketIds);
  } catch (err) {
    errors.push(`Failed to fetch associations: ${err instanceof Error ? err.message : String(err)}`);
    ticketContactMap = new Map();
  }

  // 5. Collect all unique contact IDs and batch-read their emails
  const allContactIds = new Set<string>();
  for (const contactIds of ticketContactMap.values()) {
    contactIds.forEach((id) => allContactIds.add(id));
  }

  const contactEmails = new Map<string, string>();
  if (allContactIds.size > 0) {
    try {
      const contactIdArray = [...allContactIds];
      for (let i = 0; i < contactIdArray.length; i += 100) {
        const batch = contactIdArray.slice(i, i + 100);
        const contacts = await batchReadContacts(token, batch, ["email", "firstname", "lastname"]);
        for (const contact of contacts) {
          if (contact.properties?.email) {
            contactEmails.set(contact.id, contact.properties.email);
          }
        }
      }
    } catch (err) {
      errors.push(`Failed to read contacts: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 6. Resolve owner names (batch)
  const ownerIds = new Set<string>();
  for (const ticket of allTickets) {
    if (ticket.properties.hubspot_owner_id) {
      ownerIds.add(ticket.properties.hubspot_owner_id);
    }
  }
  const ownerMap = new Map<string, { name: string; email: string }>();
  for (const ownerId of ownerIds) {
    try {
      const ownerRes = await fetch(`${BASE_URL}/crm/v3/owners/${ownerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ownerRes.ok) {
        const owner = await ownerRes.json();
        ownerMap.set(ownerId, {
          name: [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.email || "",
          email: owner.email || "",
        });
      }
    } catch {
      // Non-critical
    }
  }

  // 7. Match tickets to customers via contact email domains and build upsert records
  const matchedCustomers = new Set<string>();
  const upsertRecords: any[] = [];

  for (const ticket of allTickets) {
    const contactIds = ticketContactMap.get(ticket.id) || [];
    const contacts: Array<{ id: string; email: string }> = [];
    let matchedCustomer: { customerId: string; tenantId: string } | null = null;

    for (const contactId of contactIds) {
      const email = contactEmails.get(contactId);
      if (!email) continue;
      contacts.push({ id: contactId, email });

      const domain = email.split("@")[1]?.toLowerCase();
      if (domain && domainToCustomer.has(domain)) {
        matchedCustomer = domainToCustomer.get(domain)!;
      }
    }

    if (!matchedCustomer) continue;
    matchedCustomers.add(matchedCustomer.customerId);

    const owner = ticket.properties.hubspot_owner_id
      ? ownerMap.get(ticket.properties.hubspot_owner_id)
      : null;

    upsertRecords.push({
      customer_id: matchedCustomer.customerId,
      tenant_id: matchedCustomer.tenantId,
      hubspot_ticket_id: ticket.id,
      subject: ticket.properties.subject || null,
      description: ticket.properties.content || null,
      status: ticket.properties.hs_pipeline_stage || null,
      priority: ticket.properties.hs_ticket_priority || null,
      pipeline: ticket.properties.hs_pipeline || null,
      pipeline_stage: ticket.properties.hs_pipeline_stage || null,
      created_date: ticket.properties.createdate || null,
      modified_date: ticket.properties.hs_lastmodifieddate || null,
      closed_date: ticket.properties.closed_date || null,
      associated_contacts: contacts,
      source: ticket.properties.source_type || null,
      owner_name: owner?.name || null,
      owner_email: owner?.email || null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // 8. Upsert in batches of 50
  let ticketsSynced = 0;
  for (let i = 0; i < upsertRecords.length; i += 50) {
    const batch = upsertRecords.slice(i, i + 50);
    const { error: upsertErr } = await (supabase as any)
      .from("customer_tickets")
      .upsert(batch, { onConflict: "hubspot_ticket_id" });

    if (upsertErr) {
      errors.push(`Upsert batch ${i} failed: ${upsertErr.message}`);
    } else {
      ticketsSynced += batch.length;
    }
  }

  return {
    ticketsSynced,
    ticketsFetched: allTickets.length,
    customersMatched: matchedCustomers.size,
    errors,
  };
}
