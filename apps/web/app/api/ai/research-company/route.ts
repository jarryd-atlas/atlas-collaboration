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
      console.log(`Rate limited (429). Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

/**
 * POST /api/ai/research-company
 * Uses Claude with web_search tool to find company mission, vision, values,
 * strategic priorities, industry vertical, and key initiatives.
 */
export async function POST(req: NextRequest) {
  try {
    const { customerName, domain } = await req.json();

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json({ error: "customerName is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const systemPrompt = `You are a business research assistant. Your job is to find key information about a company using web search to help a sales team understand their customer.

Search for the company's official website, About page, annual reports, press releases, sustainability reports, and news articles.

Return a JSON object with these fields:
- "mission": string or null — the company's official mission statement (brief, 1-2 sentences max)
- "vision": string or null — the company's vision statement if distinct from mission
- "values": string or null — core values, comma-separated (e.g., "Safety, Innovation, Sustainability, Integrity")
- "priorities": string or null — current strategic priorities, growth plans, or key business objectives (2-3 sentences)
- "industry_vertical": string or null — specific industry/vertical (e.g., "Cold storage & warehousing", "Food processing & distribution", "Pharmaceutical logistics")
- "key_initiatives": string or null — major initiatives like sustainability commitments, digital transformation, expansion plans (comma-separated)

Rules:
- Only include information you find evidence for — do NOT fabricate
- Return null for any field where you can't find reliable information
- Keep responses concise — this is reference data, not a report
- Focus on information relevant to an industrial technology/energy management sales team
- Wrap the JSON in a code block`;

    const userMessage = `Research the company "${customerName}"${domain ? ` (website: ${domain})` : ""}. Find their mission, vision, values, strategic priorities, industry vertical, and key initiatives.`;

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
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      const msg = response.status === 429
        ? "AI is temporarily rate limited. Please wait a moment and try again."
        : `Claude API error: ${response.status}`;
      return NextResponse.json({ error: msg }, { status: response.status === 429 ? 429 : 500 });
    }

    const data = await response.json();

    // Extract text content
    let resultText = "";
    for (const block of data.content) {
      if (block.type === "text") {
        resultText += block.text;
      }
    }

    // Parse JSON from response
    let intelligence: any = {};
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intelligence = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse company intelligence:", resultText.substring(0, 500));
    }

    // Sanitize
    const result = {
      mission: intelligence.mission?.trim() || null,
      vision: intelligence.vision?.trim() || null,
      values: intelligence.values?.trim() || null,
      priorities: intelligence.priorities?.trim() || null,
      industry_vertical: intelligence.industry_vertical?.trim() || null,
      key_initiatives: intelligence.key_initiatives?.trim() || null,
    };

    return NextResponse.json({ intelligence: result });
  } catch (err) {
    console.error("AI company research error:", err);
    return NextResponse.json(
      { error: "Failed to research company. Please try again." },
      { status: 500 }
    );
  }
}
