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

/**
 * POST /api/ai/email-digest
 * Analyzes all recent emails for a customer and generates a communication pulse narrative.
 */
export async function POST(req: NextRequest) {
  try {
    const { customerId, customerName } = (await req.json()) as {
      customerId: string;
      customerName: string;
    };

    if (!customerId || !customerName) {
      return NextResponse.json({ error: "customerId and customerName required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const supabase = createSupabaseAdmin();

    // Fetch last 90 days of emails for this customer
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: emails, error: emailErr } = await fromTable(supabase, "customer_emails")
      .select("subject, snippet, body_plain, from_email, from_name, to_emails, date, direction, ck_user_email, gmail_thread_id")
      .eq("customer_id", customerId)
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: true });

    if (emailErr || !emails || emails.length === 0) {
      return NextResponse.json({
        error: emails?.length === 0 ? "No emails found for this customer" : emailErr?.message,
      }, { status: 400 });
    }

    // Group by thread for context
    const threads = new Map<string, any[]>();
    for (const e of emails as any[]) {
      const tid = e.gmail_thread_id;
      if (!threads.has(tid)) threads.set(tid, []);
      threads.get(tid)!.push(e);
    }

    // Build email summary for the prompt (keep under token limits)
    const emailSummaries: string[] = [];
    let charCount = 0;
    const MAX_CHARS = 60000; // ~15k tokens worth of email data

    for (const [threadId, threadEmails] of threads) {
      for (const e of threadEmails) {
        const line = [
          `[${new Date(e.date).toLocaleDateString()}]`,
          e.direction === "outbound" ? `CK(${e.ck_user_email})→` : `←${e.from_name || e.from_email}`,
          `Subj: ${e.subject || "(no subject)"}`,
          e.body_plain ? `Body: ${e.body_plain.substring(0, 300)}` : (e.snippet || ""),
        ].join(" | ");

        if (charCount + line.length > MAX_CHARS) break;
        emailSummaries.push(line);
        charCount += line.length;
      }
      if (charCount >= MAX_CHARS) break;
    }

    const systemPrompt = `You are an expert business relationship analyst at CrossnoKaye, an energy technology company. You analyze email communication between our team and customer contacts to produce a "Communication Pulse" — a narrative that tells the story of the relationship.

Your analysis should be insightful, specific, and actionable. Focus on:
1. The overall narrative arc — what's the story of this relationship?
2. Who's driving the conversation on each side?
3. What are the key topics and themes?
4. Is the relationship deepening, stable, or at risk?
5. Are there any action items, commitments, or balls being dropped?

Respond with valid JSON only (no markdown, no code blocks):
{
  "narrative": "2-4 paragraphs telling the story of the communication. Be specific about people, topics, and timing. Write in present tense where applicable.",
  "key_topics": ["topic1", "topic2", "topic3"],
  "key_contacts": [
    {"name": "Full Name", "email": "email", "role_guess": "likely title/role", "engagement": "high|medium|low"}
  ],
  "action_items": ["specific action item 1", "specific action item 2"],
  "sentiment": "positive|neutral|cautious|at_risk",
  "momentum": "accelerating|steady|slowing|stalled"
}`;

    const userMessage = `Analyze the email communication between CrossnoKaye and ${customerName}.

There are ${emails.length} emails across ${threads.size} threads over the last 90 days.

Emails (chronological):
${emailSummaries.join("\n")}`;

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
          max_tokens: 4096,
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

    // Parse JSON from response
    let digest;
    try {
      digest = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        digest = JSON.parse(jsonMatch[1]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }

    // Get customer tenant_id
    const { data: customer } = await (supabase as any)
      .from("customers")
      .select("tenant_id")
      .eq("id", customerId)
      .single();

    // Upsert digest
    const periodStart = ninetyDaysAgo;
    const periodEnd = new Date().toISOString();

    const { error: upsertErr } = await fromTable(supabase, "customer_email_digests")
      .upsert(
        {
          customer_id: customerId,
          tenant_id: customer?.tenant_id ?? "",
          period_start: periodStart,
          period_end: periodEnd,
          email_count: emails.length,
          narrative: digest.narrative || "",
          key_topics: digest.key_topics || [],
          key_contacts: digest.key_contacts || [],
          action_items: digest.action_items || [],
          sentiment: digest.sentiment || "neutral",
          momentum: digest.momentum || "steady",
          generated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" }
      );

    if (upsertErr) {
      console.error("Failed to save digest:", upsertErr.message);
    }

    return NextResponse.json({ digest });
  } catch (err) {
    console.error("Email digest error:", err);
    return NextResponse.json(
      { error: "Failed to generate communication pulse" },
      { status: 500 }
    );
  }
}
