/**
 * Claude-powered summarization and entity extraction.
 * Processes voice note transcripts to extract:
 *  - Summary
 *  - Action items / tasks
 *  - Key decisions
 *  - Project updates
 */

import Anthropic from "@anthropic-ai/sdk";

export interface ExtractedTask {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeHint: string | null;
}

export interface ExtractedDecision {
  decision: string;
  context: string;
}

export interface ExtractedUpdate {
  update: string;
  entityHint: string | null;
}

export interface SummarizationResult {
  summary: string;
  extractedTasks: ExtractedTask[];
  extractedDecisions: ExtractedDecision[];
  extractedUpdates: ExtractedUpdate[];
}

const SYSTEM_PROMPT = `You are an AI assistant for CrossnoKaye (CK), a company that deploys industrial monitoring systems called ATLAS at customer facilities (cold storage, warehouses, etc.).

You are processing a voice note transcript from a CK team member. Your job is to extract structured information from the transcript.

Respond with a JSON object (no markdown fences) with these fields:
{
  "summary": "2-3 sentence summary of the voice note",
  "extractedTasks": [
    {
      "title": "Short task title (5-10 words)",
      "description": "Detailed description of what needs to be done",
      "priority": "low|medium|high|urgent",
      "assigneeHint": "Name of person mentioned or null"
    }
  ],
  "extractedDecisions": [
    {
      "decision": "What was decided",
      "context": "Why or in what context"
    }
  ],
  "extractedUpdates": [
    {
      "update": "What progress or status was reported",
      "entityHint": "Site, milestone, or task name if mentioned, or null"
    }
  ]
}

Rules:
- Only extract tasks that are clearly actionable items, not general observations
- Priority should reflect urgency: "urgent" for safety/compliance, "high" for deadline-sensitive, "medium" for normal work, "low" for nice-to-haves
- If no tasks/decisions/updates are found, use empty arrays
- Keep summaries concise and focused on key points
- assigneeHint should be the person's name as mentioned, or null if not specified`;

/**
 * Summarize a transcript and extract structured data using Claude.
 */
export async function summarizeTranscript(
  transcript: string,
  contextHint?: string,
): Promise<SummarizationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const userMessage = contextHint
    ? `Context: ${contextHint}\n\nTranscript:\n${transcript}`
    : `Transcript:\n${transcript}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  // Extract text from response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as SummarizationResult;
    return {
      summary: parsed.summary ?? "",
      extractedTasks: Array.isArray(parsed.extractedTasks)
        ? parsed.extractedTasks
        : [],
      extractedDecisions: Array.isArray(parsed.extractedDecisions)
        ? parsed.extractedDecisions
        : [],
      extractedUpdates: Array.isArray(parsed.extractedUpdates)
        ? parsed.extractedUpdates
        : [],
    };
  } catch {
    // If JSON parsing fails, return the text as summary with no extractions
    return {
      summary: textBlock.text,
      extractedTasks: [],
      extractedDecisions: [],
      extractedUpdates: [],
    };
  }
}
