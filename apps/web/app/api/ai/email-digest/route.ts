import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

/** Retry fetch with exponential backoff on 429 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt + 1) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

/* ---------- Types ---------- */

interface TeamMember {
  name: string;
  email: string;
  email_count: number;
  thread_count: number;
  last_email_date: string;
  recent_subjects: string[];
}

interface TeamSection {
  team: string;
  team_label: string;
  summary: string;
  members: TeamMember[];
  total_emails: number;
  total_threads: number;
}

/* ---------- Helpers ---------- */

/** Normalise a role_label (or fallback) into a slug + display label */
function normaliseTeam(roleLabel: string | null): { team: string; team_label: string } {
  const raw = (roleLabel || "Other").trim();
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return { team: slug, team_label: raw };
}

/** Sort order helper — used as fallback when no department sort_order is available */
function teamSortKey(team: string): string {
  return team === "other" ? "zzz_other" : team;
}

/**
 * POST /api/ai/email-digest
 *
 * Generates a Communication Pulse for a customer using a hybrid approach:
 *   1. Aggregate email data grouped by CK team member department/role
 *   2. Use AI only for a single factual summary sentence per team section
 */
export async function POST(req: NextRequest) {
  try {
    const { customerId, customerName } = (await req.json()) as {
      customerId: string;
      customerName: string;
    };

    if (!customerId || !customerName) {
      return NextResponse.json(
        { error: "customerId and customerName required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const supabase = createSupabaseAdmin();

    // ── 1. Fetch last 90 days of emails ──────────────────────────────────
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: emails, error: emailErr } = await fromTable(supabase, "customer_emails")
      .select(
        "subject, from_email, from_name, date, direction, ck_user_id, ck_user_email, gmail_thread_id"
      )
      .eq("customer_id", customerId)
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false });

    if (emailErr || !emails || emails.length === 0) {
      return NextResponse.json(
        {
          error:
            emails?.length === 0
              ? "No emails found for this customer"
              : emailErr?.message,
        },
        { status: 400 }
      );
    }

    // ── 2. Collect distinct CK user IDs from emails ─────────────────────
    const ckUserIds = [
      ...new Set(
        (emails as any[])
          .map((e: any) => e.ck_user_id)
          .filter(Boolean) as string[]
      ),
    ];

    const ckUserEmails = [
      ...new Set(
        (emails as any[])
          .map((e: any) => e.ck_user_email)
          .filter(Boolean) as string[]
      ),
    ];

    // ── 3. Look up each user's role/department via customer_team_members → profiles ─
    // Map: ck_user_id → { name, email, team, team_label }
    type MemberInfo = { name: string; email: string; team: string; team_label: string };
    const userInfoMap = new Map<string, MemberInfo>();

    // Load all departments for lookup
    const { data: allDepartments } = await fromTable(supabase, "departments")
      .select("id, name, label, sort_order")
      .order("sort_order");
    const deptById = new Map<string, { name: string; label: string; sort_order: number }>();
    for (const d of (allDepartments || []) as any[]) {
      deptById.set(d.id, { name: d.name, label: d.label, sort_order: d.sort_order });
    }

    if (ckUserIds.length > 0) {
      // customer_team_members links profile_id → profiles (which has user_id = ck_user_id)
      const { data: teamMembers } = await fromTable(supabase, "customer_team_members")
        .select("profile_id, role_label, department_id")
        .eq("customer_id", customerId);

      if (teamMembers && teamMembers.length > 0) {
        const profileIds = (teamMembers as any[]).map((tm: any) => tm.profile_id);
        const { data: profiles } = await fromTable(supabase, "profiles")
          .select("id, user_id, full_name, email")
          .in("id", profileIds);

        if (profiles) {
          const profileById = new Map<string, any>();
          for (const p of profiles as any[]) {
            profileById.set(p.id, p);
          }

          for (const tm of teamMembers as any[]) {
            const profile = profileById.get(tm.profile_id);
            if (profile && profile.user_id) {
              // Use department if assigned, otherwise fall back to role_label, then "Other"
              const dept = tm.department_id ? deptById.get(tm.department_id) : null;
              const team = dept ? dept.name : normaliseTeam(tm.role_label).team;
              const team_label = dept ? dept.label : normaliseTeam(tm.role_label).team_label;
              userInfoMap.set(profile.user_id, {
                name: profile.full_name || profile.email,
                email: profile.email,
                team,
                team_label,
              });
            }
          }
        }
      }
    }

    // ── 4. Fallback: users who emailed but aren't in customer_team_members ─
    // Match by profiles.email for any ck_user_id not yet resolved
    const unresolvedIds = ckUserIds.filter((uid) => !userInfoMap.has(uid));
    if (unresolvedIds.length > 0) {
      const { data: fallbackProfiles } = await fromTable(supabase, "profiles")
        .select("user_id, full_name, email")
        .in("user_id", unresolvedIds);

      if (fallbackProfiles) {
        for (const p of fallbackProfiles as any[]) {
          if (!userInfoMap.has(p.user_id)) {
            userInfoMap.set(p.user_id, {
              name: p.full_name || p.email,
              email: p.email,
              team: "other",
              team_label: "Other",
            });
          }
        }
      }
    }

    // For any remaining ck_user_emails with no ck_user_id match, group under "Other"
    // Build a secondary map by email for emails without a ck_user_id
    const emailFallbackMap = new Map<string, MemberInfo>();
    for (const email of ckUserEmails) {
      // Check if any resolved user has this email
      let found = false;
      for (const info of userInfoMap.values()) {
        if (info.email === email) {
          emailFallbackMap.set(email, info);
          found = true;
          break;
        }
      }
      if (!found) {
        emailFallbackMap.set(email, {
          name: (email.split("@")[0] ?? email).replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          email,
          team: "other",
          team_label: "Other",
        });
      }
    }

    // ── 5. Group emails by department → member ──────────────────────────
    // Key: `${team}::${email}` → aggregated stats
    interface MemberAgg {
      info: MemberInfo;
      email_count: number;
      threads: Set<string>;
      subjects: string[];
      last_email_date: string;
    }

    const memberAggs = new Map<string, MemberAgg>();

    for (const e of emails as any[]) {
      // Determine the member info for this email
      let info: MemberInfo | undefined;
      if (e.ck_user_id && userInfoMap.has(e.ck_user_id)) {
        info = userInfoMap.get(e.ck_user_id);
      } else if (e.ck_user_email && emailFallbackMap.has(e.ck_user_email)) {
        info = emailFallbackMap.get(e.ck_user_email);
      }

      if (!info) {
        // Completely unknown CK user — group under Other
        const email = e.ck_user_email || e.from_email || "unknown";
        info = {
          name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          email,
          team: "other",
          team_label: "Other",
        };
      }

      const key = `${info.team}::${info.email}`;
      if (!memberAggs.has(key)) {
        memberAggs.set(key, {
          info,
          email_count: 0,
          threads: new Set<string>(),
          subjects: [],
          last_email_date: e.date,
        });
      }

      const agg = memberAggs.get(key)!;
      agg.email_count += 1;
      if (e.gmail_thread_id) agg.threads.add(e.gmail_thread_id);
      // Track unique subjects (up to 5), emails already sorted desc by date
      if (
        e.subject &&
        agg.subjects.length < 5 &&
        !agg.subjects.includes(e.subject)
      ) {
        agg.subjects.push(e.subject);
      }
      // last_email_date: we already sorted desc, so first encounter is latest
    }

    // Build team sections map
    // Build department sort order lookup
    const deptSortOrder = new Map<string, number>();
    for (const d of (allDepartments || []) as any[]) {
      deptSortOrder.set(d.name, d.sort_order);
    }

    const teamSectionsMap = new Map<
      string,
      { team: string; team_label: string; members: TeamMember[]; total_emails: number; allThreads: Set<string>; sort_order: number }
    >();

    for (const agg of memberAggs.values()) {
      const { team, team_label } = agg.info;
      if (!teamSectionsMap.has(team)) {
        teamSectionsMap.set(team, {
          team,
          team_label,
          members: [],
          total_emails: 0,
          allThreads: new Set<string>(),
          sort_order: deptSortOrder.get(team) ?? 999,
        });
      }
      const section = teamSectionsMap.get(team)!;
      section.members.push({
        name: agg.info.name,
        email: agg.info.email,
        email_count: agg.email_count,
        thread_count: agg.threads.size,
        last_email_date: new Date(agg.last_email_date).toISOString().split("T")[0] ?? "",
        recent_subjects: agg.subjects,
      });
      section.total_emails += agg.email_count;
      for (const t of agg.threads) section.allThreads.add(t);
    }

    // ── 6. Call Claude for one factual sentence per team section ─────────
    // Build the prompt with all team data
    const teamDataForPrompt = [...teamSectionsMap.values()]
      .sort((a, b) => a.sort_order - b.sort_order || teamSortKey(a.team).localeCompare(teamSortKey(b.team)))
      .map((section) => {
        const memberLines = section.members
          .map(
            (m) =>
              `  - ${m.name} (${m.email}): ${m.email_count} emails, ${m.thread_count} threads, topics: ${m.recent_subjects.join(", ") || "N/A"}`
          )
          .join("\n");
        return `Team: ${section.team_label}\nTotal: ${section.total_emails} emails, ${section.allThreads.size} threads\nMembers:\n${memberLines}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a factual communication summarizer. For each team section provided, write ONE factual sentence summarizing the communication. State only facts: who communicated, how many times, about what topics. Do NOT include sentiment, opinions, or judgments. Do NOT use words like "strong", "impressive", "great", "concerning", or any evaluative language. Just state what happened.

Respond with valid JSON only (no markdown, no code blocks). The response must be an object where keys are the team slugs and values are the single-sentence summaries.

Example:
{"account_management": "Jarryd exchanged 12 emails across 4 threads about contract terms and site visits.", "engineering": "Matt and Lisa sent 8 emails across 3 threads covering commissioning schedules and equipment specifications."}`;

    const userMessage = `Summarize the following communication data for ${customerName}:\n\n${teamDataForPrompt}`;

    const response = await fetchWithRetry(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", errText);
      return NextResponse.json(
        { error: `AI analysis failed (${response.status})` },
        { status: response.status }
      );
    }

    const aiResult = await response.json();
    const text = aiResult.content?.[0]?.text || "";

    let summaries: Record<string, string>;
    try {
      summaries = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        summaries = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback: generate basic summaries without AI
        summaries = {};
        for (const [team, section] of teamSectionsMap) {
          const names = section.members.map((m) => m.name).join(" and ");
          summaries[team] = `${names} exchanged ${section.total_emails} emails across ${section.allThreads.size} threads.`;
        }
      }
    }

    // ── 7. Build team_sections array sorted by team name ────────────────
    const teamSections: TeamSection[] = [...teamSectionsMap.values()]
      .sort((a, b) => a.sort_order - b.sort_order || teamSortKey(a.team).localeCompare(teamSortKey(b.team)))
      .map((section) => ({
        team: section.team,
        team_label: section.team_label,
        summary:
          summaries[section.team] ||
          `${section.members.map((m) => m.name).join(" and ")} exchanged ${section.total_emails} emails across ${section.allThreads.size} threads.`,
        members: section.members.sort((a, b) => b.email_count - a.email_count),
        total_emails: section.total_emails,
        total_threads: section.allThreads.size,
      }));

    // ── 8. Upsert into customer_email_digests ───────────────────────────
    const { data: customer } = await (supabase as any)
      .from("customers")
      .select("tenant_id")
      .eq("id", customerId)
      .single();

    const periodStart = ninetyDaysAgo;
    const periodEnd = new Date().toISOString();

    const { error: upsertErr } = await fromTable(supabase, "customer_email_digests")
      .upsert(
        {
          customer_id: customerId,
          tenant_id: customer?.tenant_id ?? "",
          period_start: periodStart,
          period_end: periodEnd,
          email_count: (emails as any[]).length,
          team_sections: teamSections,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" }
      );

    if (upsertErr) {
      console.error("Failed to save digest:", upsertErr.message);
    }

    return NextResponse.json({ digest: { team_sections: teamSections } });
  } catch (err) {
    console.error("Email digest error:", err);
    return NextResponse.json(
      { error: "Failed to generate communication pulse" },
      { status: 500 }
    );
  }
}
