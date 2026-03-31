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
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`Rate limited (429). Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  // Unreachable, but TypeScript needs it
  throw new Error("Max retries exceeded");
}

/**
 * POST /api/ai/suggest-leadership
 * Uses Claude with web_search tool to find company leadership and suggest
 * stakeholders for the org chart.
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

    const systemPrompt = `You are a research assistant helping build an organizational chart for a company. Your job is to find key leadership and executives at the specified company using web search.

Search for the company's leadership team, executives, and key decision-makers. Focus on:
- C-suite executives (CEO, COO, CFO, CTO, CIO, etc.)
- VP-level leaders (VP of Operations, VP of Engineering, VP of Facilities, etc.)
- Directors and senior managers in relevant departments (Operations, Engineering, Facilities, Sustainability, Energy, IT)

For each person found, provide:
- Full name
- Title/position
- Department (infer from title if not explicit)
- Who they likely report to (infer from org hierarchy — e.g., VP of Operations likely reports to COO or CEO)

Return a JSON array of objects with these fields:
- "name": string (full name)
- "title": string (job title)
- "department": string (e.g., "Executive", "Operations", "Engineering", "Finance", "IT", "Facilities", "Sustainability")
- "reports_to_name": string or null (name of their likely manager from this same list, null if top-level like CEO)

Rules:
- Only include people you find evidence for — do NOT make up contacts
- If you can't find leadership info, return an empty array
- Prioritize operations, facilities, engineering, and sustainability leaders (these are most relevant for industrial technology)
- Include 5-15 people maximum
- Order from most senior to least senior`;

    const userMessage = `Find the leadership team and key executives at ${customerName}${domain ? ` (website: ${domain})` : ""}. Search the web for their organizational structure, leadership page, press releases, and LinkedIn profiles.`;

    // Use fetch with retry for Cloudflare Workers compatibility
    const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);
      const userMessage = response.status === 429
        ? "AI is temporarily rate limited. Please wait a moment and try again."
        : `Claude API error: ${response.status}`;
      return NextResponse.json({ error: userMessage }, { status: response.status === 429 ? 429 : 500 });
    }

    const data = await response.json();

    // Extract the final text content (after tool use)
    let resultText = "";
    for (const block of data.content) {
      if (block.type === "text") {
        resultText += block.text;
      }
    }

    // Parse the JSON array from Claude's response
    let suggestions: any[] = [];
    try {
      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse leadership suggestions:", resultText.substring(0, 500));
    }

    // Validate and sanitize
    suggestions = suggestions
      .filter((s) => s && typeof s.name === "string" && s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        title: s.title?.trim() || null,
        department: s.department?.trim() || null,
        reports_to_name: s.reports_to_name?.trim() || null,
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("AI leadership suggestion error:", err);
    return NextResponse.json(
      { error: "Failed to suggest leadership. Please try again." },
      { status: 500 }
    );
  }
}
