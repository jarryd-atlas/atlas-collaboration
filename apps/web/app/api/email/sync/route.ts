import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

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

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: GmailHeader[];
    mimeType?: string;
    body?: { data?: string; size?: number };
    parts?: GmailPart[];
  };
  internalDate?: string;
}

/** Extract header value by name */
function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Parse "Name <email>" format → {name, email} */
function parseEmailAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1]!.replace(/^["']|["']$/g, "").trim(), email: match[2]!.toLowerCase() };
  }
  return { name: nameFromEmail(raw.trim()), email: raw.trim().toLowerCase() };
}

/** Parse comma-separated address list */
function parseAddressList(raw: string): Array<{ email: string; name: string }> {
  if (!raw) return [];
  return raw.split(",").map((a) => parseEmailAddress(a.trim())).filter((a) => a.email.includes("@"));
}

/** Decode base64url-encoded body data */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64);
  } catch {
    return "";
  }
}

/** Extract plain text body from Gmail message parts */
function extractPlainText(payload: GmailMessage["payload"]): string {
  if (!payload) return "";

  // Direct body (simple messages)
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — look for text/plain recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Nested multipart
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
  }

  return "";
}

/** Refresh a Google token using the refresh_token */
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

/**
 * POST /api/email/sync
 * Syncs Gmail emails for a specific user, matching to customers by domain.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = (await req.json()) as { userId: string };
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // 1. Get user's Google token
    const { data: tokenData } = await (supabase as any)
      .from("user_google_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (!tokenData) {
      return NextResponse.json({ error: "No Google token for user" }, { status: 404 });
    }

    // Get user's email for display
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const userEmail = user?.email ?? "";

    // Refresh token if expired
    let accessToken = tokenData.access_token as string;
    const expiresAt = new Date(tokenData.expires_at as string).getTime();
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      if (!tokenData.refresh_token) {
        return NextResponse.json({ error: "Token expired, no refresh token" }, { status: 401 });
      }
      const refreshed = await refreshGoogleToken(tokenData.refresh_token as string);
      if (!refreshed) {
        return NextResponse.json({ error: "Failed to refresh token" }, { status: 401 });
      }
      accessToken = refreshed;
      // Update stored token
      await (supabase as any)
        .from("user_google_tokens")
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    // 2. Load tenant domains (same as calendar sync)
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

    // 3. Load customers by tenant_id
    const tenantIds = [...domainToTenant.values()].map((t) => t.id);
    const { data: customers } = await (supabase as any)
      .from("customers")
      .select("id, name, tenant_id")
      .in("tenant_id", tenantIds);

    const tenantToCustomer = new Map<string, { id: string; name: string }>();
    for (const c of customers || []) {
      tenantToCustomer.set(c.tenant_id, { id: c.id, name: c.name });
    }

    // 4. Load account plans + existing stakeholders for auto-creation
    const { data: plans } = await (supabase as any)
      .from("account_plans")
      .select("id, customer_id");
    const customerToAccountPlan = new Map<string, string>();
    for (const p of plans || []) {
      customerToAccountPlan.set(p.customer_id, p.id);
    }

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

    // 5. Determine sync window — check last synced email date
    const { data: lastEmail } = await (supabase as any)
      .from("customer_emails")
      .select("date")
      .eq("ck_user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const afterDate = lastEmail?.date
      ? new Date(lastEmail.date as string)
      : ninetyDaysAgo;

    // Format as YYYY/MM/DD for Gmail query
    const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;

    // 6. For each customer domain, fetch matching emails from Gmail
    let synced = 0;
    let stakeholdersAdded = 0;
    const customersMatched = new Set<string>();
    const newStakeholderEmails = new Set<string>();

    for (const [domain, tenant] of domainToTenant) {
      const customer = tenantToCustomer.get(tenant.id);
      if (!customer) continue;

      // Query Gmail for emails to/from this domain
      const query = encodeURIComponent(`(from:@${domain} OR to:@${domain}) after:${afterStr}`);
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=100`;

      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!listRes.ok) {
        console.warn(`Gmail list failed for domain ${domain}: ${listRes.status}`);
        continue;
      }

      const listData = await listRes.json();
      const messageIds: string[] = (listData.messages || []).map((m: { id: string }) => m.id);

      if (messageIds.length === 0) continue;

      // Fetch each message's metadata
      for (const msgId of messageIds) {
        try {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!msgRes.ok) continue;

          const msg: GmailMessage = await msgRes.json();
          const headers = msg.payload?.headers;

          const fromRaw = getHeader(headers, "From");
          const toRaw = getHeader(headers, "To");
          const ccRaw = getHeader(headers, "Cc");
          const subject = getHeader(headers, "Subject");
          const dateRaw = getHeader(headers, "Date");

          const from = parseEmailAddress(fromRaw);
          const toList = parseAddressList(toRaw);
          const ccList = parseAddressList(ccRaw);

          // Determine direction
          const fromDomain = getEmailDomain(from.email);
          const direction = isCKEmail(from.email) ? "outbound" : "inbound";

          // Extract plain text body (first 1000 chars)
          const bodyPlain = extractPlainText(msg.payload).substring(0, 1000);

          // Parse date
          const emailDate = msg.internalDate
            ? new Date(parseInt(msg.internalDate, 10))
            : dateRaw
              ? new Date(dateRaw)
              : new Date();

          // Upsert email
          const { error: upsertErr } = await (supabase as any)
            .from("customer_emails")
            .upsert(
              {
                customer_id: customer.id,
                tenant_id: tenant.id,
                gmail_message_id: msg.id,
                gmail_thread_id: msg.threadId,
                subject: subject?.substring(0, 500) || null,
                snippet: msg.snippet?.substring(0, 300) || null,
                body_plain: bodyPlain || null,
                from_email: from.email,
                from_name: from.name,
                to_emails: toList,
                cc_emails: ccList,
                date: emailDate.toISOString(),
                direction,
                ck_user_id: userId,
                ck_user_email: userEmail,
                label_ids: msg.labelIds ?? [],
                synced_at: new Date().toISOString(),
              },
              { onConflict: "gmail_message_id" }
            );

          if (upsertErr) {
            console.error(`Failed to upsert email ${msg.id}:`, upsertErr.message);
            continue;
          }

          synced++;
          customersMatched.add(customer.id);

          // Auto-add stakeholders for external contacts
          const accountPlanId = customerToAccountPlan.get(customer.id);
          if (accountPlanId) {
            const externalContacts = direction === "inbound"
              ? [from]
              : [...toList, ...ccList].filter((a) => getEmailDomain(a.email) === domain);

            for (const contact of externalContacts) {
              const emailLower = contact.email.toLowerCase();
              if (
                !stakeholderEmails.has(emailLower) &&
                !newStakeholderEmails.has(emailLower)
              ) {
                const { error: stakeErr } = await (supabase as any)
                  .from("account_stakeholders")
                  .insert({
                    account_plan_id: accountPlanId,
                    tenant_id: tenant.id,
                    name: contact.name,
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
        } catch (msgErr) {
          console.warn(`Error processing message ${msgId}:`, msgErr);
        }
      }
    }

    return NextResponse.json({
      synced,
      customers_matched: customersMatched.size,
      stakeholders_added: stakeholdersAdded,
      user_email: userEmail,
    });
  } catch (err) {
    console.error("Email sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
