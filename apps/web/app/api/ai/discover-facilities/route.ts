import { NextRequest, NextResponse } from "next/server";

/**
 * Retry a fetch with exponential backoff on 429 responses.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 4
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < maxRetries) {
      const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s, 16s
      console.log(`Rate limited (429). Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

/**
 * Normalize an address for comparison (lowercase, strip punctuation, common abbreviations).
 */
function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bplace\b/g, "pl")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * POST /api/ai/discover-facilities
 * Uses Claude with web_search to discover company facilities.
 * Returns raw Claude-discovered addresses (no Google Places validation).
 */
export async function POST(req: NextRequest) {
  try {
    const { customerName, domain, existingAddresses } = await req.json();

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json({ error: "customerName is required" }, { status: 400 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    // Normalize existing addresses for comparison
    const normalizedExisting = (existingAddresses || [])
      .filter((a: string | null) => a)
      .map((a: string) => normalizeAddress(a));

    const systemPrompt = `You are a facility location research assistant. Your job is to find ALL known physical facility locations for a company.

Search for:
- The company's official locations/facilities page
- Wikipedia article listing locations
- Press releases about facility openings, acquisitions, expansions
- Industry databases and directories
- SEC/annual report filings mentioning facility locations
- News articles about new facilities

For each facility found, provide:
- "name": facility name or label (e.g., "Ontario Distribution Center")
- "city": city name
- "state": state/province abbreviation (e.g., "CA", "ON")
- "address": full street address if available, otherwise null
- "source": where you found this information (brief, e.g., "company website")

Return a JSON object with:
- "facilities": array of facility objects
- "total_estimated": your estimate of total facilities (may exceed what you found)
- "summary": 1-2 sentences about where you found the data and completeness

Rules:
- Only include facilities you find evidence for — do NOT fabricate locations
- Focus on US and Canada locations
- Include ALL types: warehouses, distribution centers, offices, plants, manufacturing facilities, etc.
- If the company has a locations page, prioritize that as the authoritative source
- Return up to 200 facilities maximum
- Wrap the JSON in a code block`;

    const userMessage = `Find all known facility locations for "${customerName}"${domain ? ` (website: ${domain})` : ""}. Search thoroughly — check their official site, Wikipedia, press releases, and industry databases.`;

    const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
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
    let discovered: any = { facilities: [], total_estimated: 0, summary: "" };
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        discovered = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse facilities JSON:", resultText.substring(0, 500));
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
    }

    const rawFacilities: Array<{
      name: string;
      city: string;
      state: string;
      address?: string | null;
      source?: string;
    }> = discovered.facilities || [];

    if (rawFacilities.length === 0) {
      return NextResponse.json({
        facilities: [],
        totalDiscovered: 0,
        searchSummary: discovered.summary || "No facilities found.",
      });
    }

    // Map facilities and check for duplicates
    const facilities = rawFacilities.map((raw) => {
      let address = raw.address?.trim() || "";
      const city = raw.city || "";
      const state = raw.state || "";

      // Build a composite address if no street address found
      if (!address && city) {
        address = `${city}, ${state}`.trim();
      }

      // Check for duplicates against existing addresses
      const normalizedAddr = normalizeAddress(address);
      const alreadyExists = normalizedExisting.some(
        (existing: string) =>
          existing === normalizedAddr ||
          existing.includes(normalizedAddr) ||
          normalizedAddr.includes(existing)
      );

      return {
        name: raw.name || `${city} Facility`,
        address,
        city,
        state,
        alreadyExists,
        source: raw.source || "AI research",
      };
    });

    return NextResponse.json({
      facilities,
      totalDiscovered: discovered.total_estimated || rawFacilities.length,
      searchSummary: discovered.summary || `Found ${rawFacilities.length} facilities.`,
    });
  } catch (err) {
    console.error("Discover facilities error:", err);
    return NextResponse.json(
      { error: "Failed to discover facilities. Please try again." },
      { status: 500 }
    );
  }
}
