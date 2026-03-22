import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ExtractedTask {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  suggestedAssignee?: string;
}

/**
 * POST /api/ai/extract-tasks
 * Takes natural language text and extracts structured tasks using Claude.
 * Used by the voice-to-tasks feature and the AI task creator.
 */
export async function POST(req: NextRequest) {
  try {
    const { text, context } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const systemPrompt = `You are a task extraction assistant for a project management tool used by CrossnoKaye, an industrial technology company.

Extract actionable tasks from the user's input. Each task should be:
- Clear and specific
- Actionable (starts with a verb when possible)
- Appropriately prioritized

Return a JSON array of tasks. Each task has:
- "title": string (concise, actionable task title)
- "description": string or null (additional detail if the input provides it)
- "priority": "low" | "medium" | "high" | "urgent" (infer from context/urgency words)

Rules:
- If the input is a single clear task, return one task
- If the input contains multiple tasks (separated by "and", commas, bullet points, or new ideas), split them
- If the input is conversational/rambling, extract the actionable items
- Default priority is "medium" unless urgency is implied
- "ASAP", "urgent", "critical", "immediately" → "urgent"
- "important", "soon", "this week" → "high"
- "when you get a chance", "low priority", "eventually" → "low"
- Keep titles under 100 characters
- Do NOT include tasks that are already done/completed (past tense observations)`;

    const contextInfo = context
      ? `\n\nContext: The user is working within ${context.customerName ? `customer "${context.customerName}"` : "the portfolio"}${context.siteName ? `, site "${context.siteName}"` : ""}${context.milestoneName ? `, milestone "${context.milestoneName}"` : ""}.`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt + contextInfo,
      messages: [
        {
          role: "user",
          content: `Extract tasks from the following:\n\n"${text}"`,
        },
      ],
    });

    // Extract the text content
    const content = response.content[0] as { type: string; text: string } | undefined;
    if (!content || content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response format" }, { status: 500 });
    }

    // Parse the JSON from Claude's response
    let tasks: ExtractedTask[] = [];
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      } else {
        // Try parsing the whole response
        tasks = JSON.parse(content.text);
      }
    } catch {
      // If parsing fails, create a single task from the input
      tasks = [{ title: text.slice(0, 100), priority: "medium" }];
    }

    // Validate and sanitize
    tasks = tasks
      .filter((t) => t && typeof t.title === "string" && t.title.trim())
      .map((t) => ({
        title: t.title.trim().slice(0, 200),
        description: t.description?.trim() || undefined,
        priority: ["low", "medium", "high", "urgent"].includes(t.priority)
          ? t.priority
          : "medium",
      }));

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("AI task extraction error:", err);
    return NextResponse.json(
      { error: "Failed to extract tasks" },
      { status: 500 }
    );
  }
}
