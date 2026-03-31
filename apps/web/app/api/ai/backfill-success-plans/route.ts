import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

const fromTable = (sb: any, table: string) => sb.from(table);

/**
 * POST /api/ai/backfill-success-plans
 * Backfills company intelligence + success plan goals/milestones
 * for existing companies that don't have them yet.
 */
export async function POST(req: NextRequest) {
  try {
    const { limit = 5 } = await req.json().catch(() => ({}));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = createSupabaseAdmin();

    // Get all account plans
    const { data: plans } = await fromTable(supabase, "account_plans")
      .select("id, customer_id, tenant_id, account_stage, industry_vertical, company_priorities, key_initiatives, intelligence_fetched_at");

    if (!plans || plans.length === 0) {
      return NextResponse.json({ processed: 0, skipped: 0, errors: [], message: "No account plans found" });
    }

    // Get goals and milestones counts per plan
    const { data: goalCounts } = await fromTable(supabase, "success_plan_goals")
      .select("account_plan_id");
    const { data: milestoneCounts } = await fromTable(supabase, "success_plan_milestones")
      .select("account_plan_id");

    const goalsByPlan = new Set((goalCounts || []).map((g: any) => g.account_plan_id));
    const milestonesByPlan = new Set((milestoneCounts || []).map((m: any) => m.account_plan_id));

    // Filter to plans without goals AND without milestones
    const eligiblePlans = plans.filter(
      (p: any) => !goalsByPlan.has(p.id) && !milestonesByPlan.has(p.id)
    ).slice(0, limit);

    if (eligiblePlans.length === 0) {
      return NextResponse.json({
        processed: 0,
        skipped: plans.length,
        errors: [],
        message: "All companies already have success plans",
      });
    }

    // Get customer names
    const customerIds = eligiblePlans.map((p: any) => p.customer_id);
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", customerIds);

    const customerMap = new Map((customers || []).map((c: any) => [c.id, c.name]));

    // Get tenant domains
    const tenantIds = [...new Set(eligiblePlans.map((p: any) => p.tenant_id))] as string[];
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, domain")
      .in("id", tenantIds);

    const tenantMap = new Map((tenants || []).map((t: any) => [t.id, t.domain]));

    const results = { processed: 0, skipped: plans.length - eligiblePlans.length, errors: [] as string[] };

    for (const plan of eligiblePlans) {
      const customerName = customerMap.get(plan.customer_id) || "Unknown";
      const domain = tenantMap.get(plan.tenant_id);

      try {
        // Step 1: Research company (if not already done)
        let intelligence = {
          industry_vertical: plan.industry_vertical,
          company_priorities: plan.company_priorities,
          key_initiatives: plan.key_initiatives,
        };

        if (!plan.intelligence_fetched_at) {
          const researchRes = await fetchWithRetry(
            "https://api.anthropic.com/v1/messages",
            buildResearchRequest(apiKey, customerName, domain),
          );

          if (researchRes.ok) {
            const data = await researchRes.json();
            let resultText = "";
            for (const block of data.content) {
              if (block.type === "text") resultText += block.text;
            }
            try {
              const jsonMatch = resultText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                intelligence = {
                  industry_vertical: parsed.industry_vertical || intelligence.industry_vertical,
                  company_priorities: parsed.priorities || intelligence.company_priorities,
                  key_initiatives: parsed.key_initiatives || intelligence.key_initiatives,
                };

                // Save intelligence
                await fromTable(supabase, "account_plans")
                  .update({
                    company_mission: parsed.mission || null,
                    company_vision: parsed.vision || null,
                    company_values: parsed.values || null,
                    company_priorities: parsed.priorities || null,
                    industry_vertical: parsed.industry_vertical || null,
                    key_initiatives: parsed.key_initiatives || null,
                    intelligence_fetched_at: new Date().toISOString(),
                  })
                  .eq("id", plan.id);
              }
            } catch { /* parse error, continue */ }
          }
          // Delay between API calls
          await new Promise((r) => setTimeout(r, 2000));
        }

        // Step 2: Generate success plan
        const planRes = await fetchWithRetry(
          "https://api.anthropic.com/v1/messages",
          buildSuccessPlanRequest(apiKey, customerName, plan.account_stage, intelligence),
        );

        if (planRes.ok) {
          const data = await planRes.json();
          let resultText = "";
          for (const block of data.content) {
            if (block.type === "text") resultText += block.text;
          }

          try {
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              const now = new Date();

              // Insert goals
              const goalsToInsert = (parsed.goals || [])
                .filter((g: any) => g?.title)
                .map((g: any) => ({
                  account_plan_id: plan.id,
                  tenant_id: plan.tenant_id,
                  title: g.title.trim(),
                  description: g.description?.trim() || null,
                }));

              if (goalsToInsert.length > 0) {
                await fromTable(supabase, "success_plan_goals").insert(goalsToInsert);
              }

              // Insert milestones
              const milestonesToInsert = (parsed.milestones || [])
                .filter((m: any) => m?.title)
                .map((m: any) => {
                  const monthsOut = typeof m.target_months_out === "number" ? m.target_months_out : 3;
                  const targetDate = new Date(now);
                  targetDate.setMonth(targetDate.getMonth() + monthsOut);
                  return {
                    account_plan_id: plan.id,
                    tenant_id: plan.tenant_id,
                    title: m.title.trim(),
                    description: m.description?.trim() || null,
                    target_date: targetDate.toISOString().split("T")[0],
                    status: "planned",
                  };
                });

              if (milestonesToInsert.length > 0) {
                await fromTable(supabase, "success_plan_milestones").insert(milestonesToInsert);
              }

              results.processed++;
            }
          } catch {
            results.errors.push(`${customerName}: Failed to parse success plan`);
          }
        } else {
          results.errors.push(`${customerName}: API error ${planRes.status}`);
        }

        // Delay between companies
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err: any) {
        results.errors.push(`${customerName}: ${err.message}`);
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Backfill error:", err);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}

// ─── Helpers ───────────────────────────────────────────

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
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

function buildResearchRequest(apiKey: string, customerName: string, domain?: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a business research assistant. Search for the company and return a JSON object with: mission, vision, values, priorities, industry_vertical, key_initiatives. Return null for fields you can't find. Wrap JSON in a code block.`,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: `Research "${customerName}"${domain ? ` (${domain})` : ""}. Find their mission, vision, values, strategic priorities, industry, and key initiatives.` }],
    }),
  };
}

function buildSuccessPlanRequest(
  apiKey: string,
  customerName: string,
  accountStage: string,
  intelligence: { industry_vertical?: string; company_priorities?: string; key_initiatives?: string },
): RequestInit {
  let userMsg = `Generate a success plan for ${customerName}.\n- Account stage: ${accountStage || "pilot"}`;
  if (intelligence.industry_vertical) userMsg += `\n- Industry: ${intelligence.industry_vertical}`;
  if (intelligence.company_priorities) userMsg += `\n- Priorities: ${intelligence.company_priorities}`;
  if (intelligence.key_initiatives) userMsg += `\n- Initiatives: ${intelligence.key_initiatives}`;

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are a customer success strategist for CrossnoKaye, an industrial refrigeration monitoring and energy management company. Generate goals (3-5) and milestones (4-6) for the customer's success plan. Return JSON: { "goals": [{"title","description"}], "milestones": [{"title","description","target_months_out"}] }. Tailor to the customer's stage (pilot/expanding/enterprise) and industry. Wrap JSON in a code block.`,
      messages: [{ role: "user", content: userMsg }],
    }),
  };
}
