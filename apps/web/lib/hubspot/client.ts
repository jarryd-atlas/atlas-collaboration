/**
 * HubSpot CRM API v3 client.
 * Raw fetch wrapper — no SDK dependency.
 */

import type { HubSpotDeal, HubSpotSearchResult, HubSpotProperty, HubSpotPropertiesResponse } from "./types";

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

// ─── Property Definitions ──────────────────────────────────

/** List all deal property definitions */
export async function getDealProperties(token: string): Promise<HubSpotProperty[]> {
  const res = await hubspotFetch<HubSpotPropertiesResponse>(
    token,
    "/crm/v3/properties/deals"
  );
  return res.results;
}
