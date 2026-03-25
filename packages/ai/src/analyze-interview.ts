/**
 * Post-interview transcript analysis.
 * Uses Claude to extract structured baseline data from a completed interview transcript.
 * Reuses the same BaselineExtraction type as document extraction for consistent data handling.
 */

import type { BaselineExtraction } from "./extract-baseline";

export interface TranscriptEntry {
  role: "agent" | "user";
  text: string;
  timestamp: number;
}

const ANALYSIS_PROMPT = `You are an AI assistant for CrossnoKaye (CK), a company that deploys ATLAS industrial monitoring systems at cold storage and refrigeration facilities.

You are analyzing a completed interview transcript between an ATLAS interview agent and site staff. Extract ALL structured baseline data mentioned in the conversation.

The transcript is a voice conversation, so:
- Data may be mentioned casually ("we've got two 570 horse Fricks on the low side")
- Names/emails/phones may have speech recognition artifacts — use your best judgment to clean them up
- The same data point may be mentioned multiple times — use the most complete/accurate version
- Some data may be corrected mid-conversation — use the final corrected value

Respond with a JSON object (no markdown fences) with these fields. Only include sections where you found clear data:

{
  "equipment": [
    {
      "category": "compressor|condenser|evaporator|vessel|vfd|pump|controls|other",
      "name": "e.g. C-1",
      "manufacturer": "e.g. Frick",
      "model": "e.g. RWB-II-222",
      "quantity": 1,
      "specs": {
        "type": "screw|reciprocating|rotary",
        "hp": 570,
        "loop": "low|high|blast",
        "loading_summer": 1.0,
        "loading_shoulder": 0.75,
        "loading_winter": 0.0,
        "suction_setpoint_psig": 6.5,
        "discharge_setpoint_psig": 120,
        "defrost_type": "hot gas|electric|air|water"
      },
      "notes": "any additional context"
    }
  ],
  "touSchedule": {
    "supplyProvider": "e.g. Constellation",
    "distributionProvider": "e.g. Delmarva Power",
    "accountNumber": "if mentioned",
    "rateName": "if mentioned",
    "demandResponseStatus": "enrolled|not_enrolled|interested"
  },
  "operationalParams": {
    "operatingDaysPerWeek": 7,
    "dailyOperationalHours": 24,
    "systemType": "two_stage|single_stage|cascade",
    "refrigerant": "ammonia|R-404A|R-22|CO2",
    "controlSystem": "Frick|Logix|GEA|SCADA|Opto22",
    "controlHardware": "e.g. Allen-Bradley",
    "facilityType": "cold_storage|food_processing|distribution",
    "runs247": true,
    "hasBlastFreezing": false
  },
  "operations": {
    "dischargePressureTypical": 120,
    "suctionPressureTypical": 6.5,
    "canShedLoad": true,
    "canShutdown": false,
    "shutdownConstraints": "text",
    "curtailmentEnrolled": false,
    "seasonalityNotes": "text",
    "temperatureChallenges": "text",
    "operationalNuances": "text"
  },
  "labor": {
    "headcount": [
      {"role": "operator", "count": 3, "hoursPerWeek": 40}
    ],
    "painPoints": "text",
    "manualProcesses": "text",
    "timeSinks": "text",
    "automationOpportunities": "text"
  },
  "siteContacts": [
    {"name": "John Smith", "title": "Plant Manager", "email": "john@example.com", "phone": "555-123-4567"}
  ],
  "confidence": 0.85,
  "notes": "Any data gaps, follow-up items, or uncertainties",
  "summary": "2-3 sentence summary of the interview covering key topics discussed, who provided the info, and what was learned",
  "sectionsFound": ["equipment", "operationalParams", "siteContacts"]
}

Rules:
- Extract EVERY piece of structured data mentioned in the conversation
- For contacts: clean up speech-recognition artifacts in emails/names (e.g., "john at example dot com" → "john@example.com")
- For equipment: each distinct piece of equipment should be its own entry
- For numbers: use the corrected/final value if the person corrected themselves
- The "summary" field is CRITICAL — it will be used to brief future interviewers about what was covered
- The "notes" field should mention any topics the interviewer asked about but the person didn't know or couldn't answer
- Set confidence 0-1 based on how clear/complete the data was
- Only include sections where real data was discussed — don't fabricate
- Dollar amounts should be numbers without $ signs
- Include "sectionsFound" listing which top-level keys have data`;

/**
 * Analyze an interview transcript to extract structured baseline data.
 *
 * @param transcript - Array of conversation entries
 * @param anthropicApiKey - Anthropic API key (optional, falls back to env)
 * @returns BaselineExtraction with extracted data + summary
 */
export async function analyzeInterviewTranscript(
  transcript: TranscriptEntry[],
  anthropicApiKey?: string,
): Promise<BaselineExtraction> {
  const apiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Format transcript as readable dialogue
  const formattedTranscript = transcript
    .map((entry) => {
      const speaker = entry.role === "agent" ? "ATLAS Agent" : "Site Staff";
      return `[${speaker}]: ${entry.text}`;
    })
    .join("\n\n");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this interview transcript and extract all structured baseline data:\n\n${formattedTranscript}`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text();
    throw new Error(`Anthropic API error (${anthropicRes.status}): ${errBody}`);
  }

  const response = (await anthropicRes.json()) as {
    content: { type: string; text: string }[];
  };
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text response from Claude");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as BaselineExtraction;
    return {
      equipment: parsed.equipment,
      energyData: parsed.energyData,
      touSchedule: parsed.touSchedule,
      rateStructure: parsed.rateStructure,
      operationalParams: parsed.operationalParams,
      operations: parsed.operations,
      labor: parsed.labor,
      savingsResults: parsed.savingsResults,
      siteContacts: parsed.siteContacts,
      confidence: parsed.confidence ?? 0.5,
      notes: parsed.notes ?? "",
      summary: parsed.summary ?? "",
      sectionsFound: parsed.sectionsFound ?? [],
    };
  } catch {
    throw new Error(
      `Failed to parse interview analysis response: ${textBlock.text.slice(0, 200)}`,
    );
  }
}
