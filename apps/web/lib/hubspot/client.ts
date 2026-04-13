/**
 * HubSpot CRM API v3 client.
 * Raw fetch wrapper — no SDK dependency.
 */

import type {
  HubSpotDeal,
  HubSpotSearchResult,
  HubSpotProperty,
  HubSpotPropertiesResponse,
  HubSpotTicketSearchResult,
  HubSpotAssociationsResponse,
  HubSpotContact,
} from "./types";

const BASE_URL = "https://api.hubapi.com";

async function hubspotFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Deal Operations ───────────────────────────────────────

/** Fetch a single deal with specified properties */
export async function getDeal(
  token: string,
  dealId: string,
  properties: string[]
): Promise<HubSpotDeal> {
  const params = new URLSearchParams();
  properties.forEach((p) => params.append("properties", p));

  return hubspotFetch<HubSpotDeal>(
    token,
    `/crm/v3/objects/deals/${dealId}?${params.toString()}`
  );
}

/** Batch-read multiple deals with specified properties */
export async function getDeals(
  token: string,
  dealIds: string[],
  properties: string[]
): Promise<HubSpotDeal[]> {
  if (dealIds.length === 0) return [];
  const result = await hubspotFetch<{ results: HubSpotDeal[] }>(
    token,
    "/crm/v3/objects/deals/batch/read",
    {
      method: "POST",
      body: JSON.stringify({
        inputs: dealIds.map((id) => ({ id })),
        properties,
      }),
    }
  );
  return result.results ?? [];
}

/** List all deals with pagination (fetches all pages) */
export async function listAllDeals(
  token: string,
  properties: string[]
): Promise<HubSpotDeal[]> {
  const allDeals: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("limit", "100");
    properties.forEach((p) => params.append("properties", p));
    if (after) params.set("after", after);

    const result = await hubspotFetch<{
      results: HubSpotDeal[];
      paging?: { next?: { after: string } };
    }>(token, `/crm/v3/objects/deals?${params.toString()}`);

    allDeals.push(...(result.results ?? []));
    after = result.paging?.next?.after;
  } while (after);

  return allDeals;
}

/** Search deals by name (for combobox) */
export async function searchDeals(
  token: string,
  query: string,
  limit = 20
): Promise<HubSpotSearchResult> {
  return hubspotFetch<HubSpotSearchResult>(token, "/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["dealname", "dealstage", "amount", "hubspot_owner_id", "closedate", "pipeline"],
    }),
  });
}

/** Update deal properties */
export async function updateDeal(
  token: string,
  dealId: string,
  properties: Record<string, string>
): Promise<HubSpotDeal> {
  return hubspotFetch<HubSpotDeal>(token, `/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// ─── Contact Operations ───────────────────────────────────

/** Batch-read contacts with specified properties */
export async function batchReadContacts(
  token: string,
  contactIds: string[],
  properties: string[]
): Promise<HubSpotContact[]> {
  if (contactIds.length === 0) return [];
  const result = await hubspotFetch<{ results: HubSpotContact[] }>(
    token,
    "/crm/v3/objects/contacts/batch/read",
    {
      method: "POST",
      body: JSON.stringify({
        inputs: contactIds.map((id) => ({ id })),
        properties,
      }),
    }
  );
  return result.results ?? [];
}

// ─── Property Definitions ──────────────────────────────────

/** List all deal property definitions */
export async function getDealProperties(token: string): Promise<HubSpotProperty[]> {
  const res = await hubspotFetch<HubSpotPropertiesResponse>(
    token,
    "/crm/v3/properties/deals"
  );
  return res.results;
}
