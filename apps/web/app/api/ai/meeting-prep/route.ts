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
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(`Rate limited (429). Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  throw new Error("Max retries exceeded");
}

interface AttendeeInput {
  name: string;
  email: string;
}

interface ExistingStakeholder {
  id: string;
  name: string;
  email: string | null;
}

/**
 * POST /api/ai/meeting-prep
 * Researches a list of meeting attendees using Claude with web search.
 * Returns enriched profiles matched against existing stakeholders.
 */
export async function POST(req: NextRequest) {
  try {
    const { customerName, domain, attendees, existingStakeholders } = await req.json() as {
      customerName: string;
      domain?: string | null;
      attendees: AttendeeInput[];
      existingStakeholders: ExistingStakeholder[];
    };

    if (!customerName || !attendees || attendees.length === 0) {
      return NextResponse.json(
        { error: "customerName and attendees are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    // Build attendee list for the prompt
    const attendeeList = attendees
      .map((a, i) => `${i + 1}. ${a.name} (${a.email})`)
      .join("\n");

    const systemPrompt = `You are a meeting preparation research assistant. You have a list of attendees for an upcoming meeting with ${customerName}. Your job is to research each person and provide intelligence about who they are, their role, and what they likely care about.

Given the attendee list, use web search to:
1. Find ${customerName}'s organizational structure, leadership page, or org chart
2. Search for attendees by name + company to find their titles and roles
3. Check press releases, LinkedIn, or news for role information

For EACH attendee, return:
- "name": their full name (cleaned up from the input)
- "email": their email address
- "title": their job title (best guess based on research; if unknown say "Unknown")
- "department": inferred department (e.g., "Operations", "Engineering", "IT", "Finance", "Sales", "Facilities", "Executive")
- "seniority": one of "executive", "senior", "mid", "junior", "unknown"
- "likely_concerns": 1-2 sentences about what this person likely cares about in a meeting context (based on their role and department)
- "reports_to_name": who they likely report to from this same attendee list (or null)
- "confidence": "high", "medium", or "low" — how confident you are in the title/role info
- "stakeholder_role_suggestion": one of "champion", "decision_maker", "influencer", "user", "economic_buyer", or null

Rules:
- Use the email addresses to help identify the company domain and infer roles
- If you can't find specific info about a person, still include them with confidence "low" and infer what you can from their name/email
- Do NOT fabricate specific titles — use "Unknown" if truly unsure
- Group the results by department in the output array
- Return a JSON array wrapped in a code block`;

    const userMessage = `Here are the attendees for an upcoming meeting with ${customerName}${domain ? ` (website: ${domain})` : ""}:

${attendeeList}

Research these people and provide a meeting preparation brief. Search for ${customerName}'s organizational structure and try to identify each person's role and title.`;

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
        // Include API error detail for debugging
        try {
          const errData = JSON.parse(errorText);
          msg = `Failed to research attendees: ${errData?.error?.message || "Bad request"}`;
        } catch {
          msg = "Failed to research attendees. Please try again.";
        }
      } else {
        msg = `AI research failed (${response.status}). Please try again.`;
      }
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

    // Parse JSON array from response
    let researched: any[] = [];
    try {
      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        researched = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error("Failed to parse meeting prep JSON:", resultText.substring(0, 500));
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
    }

    // Validate and sanitize
    researched = researched
      .filter((r) => r && typeof r.name === "string" && r.name.trim())
      .map((r) => ({
        name: r.name?.trim() || "",
        email: r.email?.trim()?.toLowerCase() || "",
        title: r.title?.trim() || "Unknown",
        department: r.department?.trim() || "Unknown",
        seniority: ["executive", "senior", "mid", "junior", "unknown"].includes(r.seniority) ? r.seniority : "unknown",
        likely_concerns: r.likely_concerns?.trim() || null,
        reports_to_name: r.reports_to_name?.trim() || null,
        confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : "low",
        stakeholder_role_suggestion: ["champion", "decision_maker", "influencer", "user", "economic_buyer"].includes(r.stakeholder_role_suggestion)
          ? r.stakeholder_role_suggestion
          : null,
      }));

    // Match against existing stakeholders
    const stakeholdersByEmail = new Map<string, string>();
    const stakeholdersByName = new Map<string, string>();
    for (const s of existingStakeholders || []) {
      if (s.email) stakeholdersByEmail.set(s.email.toLowerCase(), s.id);
      stakeholdersByName.set(s.name.toLowerCase(), s.id);
    }

    const enriched = researched.map((r) => {
      const matchedById =
        stakeholdersByEmail.get(r.email) ||
        stakeholdersByName.get(r.name.toLowerCase()) ||
        null;

      return {
        ...r,
        matched_stakeholder_id: matchedById,
      };
    });

    return NextResponse.json({ attendees: enriched });
  } catch (err) {
    console.error("Meeting prep error:", err);
    return NextResponse.json(
      { error: "Failed to research attendees. Please try again." },
      { status: 500 }
    );
  }
}
