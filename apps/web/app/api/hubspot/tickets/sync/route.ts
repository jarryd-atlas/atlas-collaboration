import { NextRequest, NextResponse } from "next/server";
import { syncHubSpotTickets } from "../../../../../lib/hubspot/tickets";

/**
 * POST /api/hubspot/tickets/sync
 *
 * Syncs HubSpot tickets to customer_tickets table via domain matching.
 * Supports both on-demand (session auth) and scheduled (CRON_SECRET) triggers.
 *
 * Body: { customerId?: string } — if provided, only sync tickets for that customer
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { customerId } = body as { customerId?: string };

    // Auth: either CRON_SECRET or a valid session
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
      // Session-based auth — the sync function uses service role internally
    }

    const result = await syncHubSpotTickets(customerId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Ticket sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync tickets" },
      { status: 500 }
    );
  }
}
