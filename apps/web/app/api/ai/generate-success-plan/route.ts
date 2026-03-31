import { NextRequest, NextResponse } from "next/server";

/**
 * Retry a fetch with exponential backoff on 429 responses.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited (429). Retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

/**
 * POST /api/ai/generate-success-plan
 * Uses Claude (no web search) to generate recommended goals and milestones
 * for a customer's success plan based on their account stage and context.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      customerName,
      accountStage,
      industryVertical,
      companyPriorities,
      keyInitiatives,
      siteCount,
    } = await req.json();

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json({ error: "customerName is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const systemPrompt = `You are a customer success strategist for CrossnoKaye, an industrial technology company. CrossnoKaye provides:
- ATLAS: A real-time industrial refrigeration monitoring and energy management platform
- Site-level monitoring of compressors, condensers, evaporators, and refrigeration systems
- Energy consumption tracking, demand response, and cost optimization
- Automated alerts, compliance monitoring, and food safety assurance
- Baseline assessments and ROI analysis for industrial facilities

CrossnoKaye's go-to-market motion is:
1. PILOT: Land 1-3 pilot sites to prove ROI. Focus on baseline data collection, demonstrating energy savings, and alarm response improvement.
2. EXPAND: Roll out to additional sites. Focus on portfolio-wide visibility, standardization, and expanding the value story.
3. ENTERPRISE: Close a company-wide or portfolio-wide agreement. Focus on strategic alignment, executive sponsorship, and long-term partnership.

Common customer value drivers:
- Energy cost reduction (typically 10-30% savings)
- Food safety & regulatory compliance (USDA, FDA, FSMA)
- Labor optimization (reduce manual monitoring rounds)
- Equipment uptime & predictive maintenance
- Sustainability reporting & carbon footprint reduction
- Portfolio-wide visibility for multi-site operators
- Demand response revenue
- Insurance risk reduction

Your job is to generate a tailored success plan (shared goals and proof-point milestones) for a customer based on their account stage, industry, and priorities.

Return a JSON object:
{
  "goals": [
    { "title": "string", "description": "string — 1-2 sentence explanation" }
  ],
  "milestones": [
    { "title": "string", "description": "string — what this proves", "target_months_out": number }
  ]
}

Rules:
- Generate 3-5 goals and 4-6 milestones
- Goals should be outcome-oriented, measurable where possible
- Milestones should be time-sequenced proof points that build toward the enterprise close
- Tailor to the customer's industry vertical and stated priorities if provided
- target_months_out is approximate months from now (used to set target dates)
- Keep language professional but accessible — these will be shared with customers
- Wrap the JSON in a code block`;

    let userMessage = `Generate a success plan for ${customerName}.`;
    userMessage += `\n- Account stage: ${accountStage || "pilot"}`;
    if (industryVertical) userMessage += `\n- Industry: ${industryVertical}`;
    if (companyPriorities) userMessage += `\n- Company priorities: ${companyPriorities}`;
    if (keyInitiatives) userMessage += `\n- Key initiatives: ${keyInitiatives}`;
    if (siteCount) userMessage += `\n- Number of sites: ${siteCount}`;

    const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      let msg: string;
      if (response.status === 429) {
        msg = "AI is temporarily rate limited. Please wait a moment and try again.";
      } else if (response.status === 400) {
        console.error("Claude API 400 details:", errorText);
        try {
          const errData = JSON.parse(errorText);
          msg = `Failed to generate success plan: ${errData?.error?.message || "Bad request"}`;
        } catch {
          msg = "Failed to generate success plan. Please try again.";
        }
      } else {
        msg = `AI generation failed (${response.status}). Please try again.`;
      }
      return NextResponse.json({ error: msg }, { status: response.status === 429 ? 429 : 500 });
    }

    const data = await response.json();

    let resultText = "";
    for (const block of data.content) {
      if (block.type === "text") {
        resultText += block.text;
      }
    }

    // Parse JSON
    let plan: any = { goals: [], milestones: [] };
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse success plan:", resultText.substring(0, 500));
    }

    // Validate and sanitize
    const goals = (plan.goals || [])
      .filter((g: any) => g && typeof g.title === "string" && g.title.trim())
      .map((g: any) => ({
        title: g.title.trim(),
        description: g.description?.trim() || null,
      }));

    const now = new Date();
    const milestones = (plan.milestones || [])
      .filter((m: any) => m && typeof m.title === "string" && m.title.trim())
      .map((m: any) => {
        const monthsOut = typeof m.target_months_out === "number" ? m.target_months_out : 3;
        const targetDate = new Date(now);
        targetDate.setMonth(targetDate.getMonth() + monthsOut);
        return {
          title: m.title.trim(),
          description: m.description?.trim() || null,
          target_date: targetDate.toISOString().split("T")[0],
          status: "planned" as const,
        };
      });

    return NextResponse.json({ goals, milestones });
  } catch (err) {
    console.error("AI success plan generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate success plan. Please try again." },
      { status: 500 }
    );
  }
}
