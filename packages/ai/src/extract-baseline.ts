/**
 * AI-powered baseline data extraction from uploaded documents.
 * Uses Claude to analyze utility bills, P&IDs, equipment lists,
 * and other documents to extract structured assessment data.
 */

// Using direct fetch instead of SDK for Cloudflare Workers compatibility

// ─── Types ────────────────────────────────────────────────────────────

export interface ExtractedEquipment {
  category: string;
  name?: string;
  manufacturer?: string;
  model?: string;
  quantity?: number;
  specs: Record<string, unknown>;
  notes?: string;
}

export interface ExtractedEnergyData {
  periodMonth?: string; // YYYY-MM-DD
  totalCharges?: number;
  totalKwh?: number;
  peakDemandKw?: number;
  supplyCharges?: number;
  distributionCharges?: number;
  onPeakKwh?: number;
  offPeakKwh?: number;
  shoulderKwh?: number;
  onPeakDemandKw?: number;
  offPeakDemandKw?: number;
  capacityPlcKw?: number;
  transmissionPlcKw?: number;
  salesTax?: number;
}

export interface ExtractedTouSchedule {
  supplyProvider?: string;
  distributionProvider?: string;
  accountNumber?: string;
  meterNumber?: string;
  rateName?: string;
  rateIdExternal?: string;
  demandResponseStatus?: string;
  onPeakEnergyRate?: number;
  onPeakDemandRate?: number;
  onPeakStartHour?: number;
  onPeakEndHour?: number;
  onPeakMonths?: string;
  offPeakEnergyRate?: number;
  offPeakDemandRate?: number;
  shoulderEnergyRate?: number;
  shoulderDemandRate?: number;
  shoulderStartHour?: number;
  shoulderEndHour?: number;
  shoulderMonths?: string;
}

export interface ExtractedRateStructure {
  fixedUsagePct?: number;
  variableTouUsagePct?: number;
  maxDemandPct?: number;
  variableTouDemandPct?: number;
  coincidentPeakPct?: number;
  otherFixedPct?: number;
  cpZone?: string;
  avgCpTagKw?: number;
  capacityRatePerKwYr?: number;
  transmissionRatePerKwYr?: number;
}

export interface ExtractedOperationalParams {
  operatingDaysPerWeek?: number;
  dailyOperationalHours?: number;
  loadFactor?: number;
  offOpsEnergyUse?: number;
  systemType?: string;
  refrigerant?: string;
  controlSystem?: string;
  controlHardware?: string;
  facilityType?: string;
  runs247?: boolean;
  hasSubMetering?: boolean;
  hasBlastFreezing?: boolean;
  requiredUpgrades?: string;
  estimatedUpgradeCost?: number;
  surveyNotes?: string;
}

export interface ExtractedOperations {
  dischargePressureTypical?: number;
  suctionPressureTypical?: number;
  canShedLoad?: boolean;
  canShutdown?: boolean;
  shutdownConstraints?: string;
  curtailmentEnrolled?: boolean;
  curtailmentFrequency?: string;
  curtailmentBarriers?: string;
  seasonalityNotes?: string;
  temperatureChallenges?: string;
  operationalNuances?: string;
  productNotes?: string;
  staffingNotes?: string;
}

export interface ExtractedLabor {
  headcount?: Array<{
    role: string;
    count: number;
    hoursPerWeek?: number;
    hourlyRate?: number;
  }>;
  painPoints?: string;
  manualProcesses?: string;
  timeSinks?: string;
  automationOpportunities?: string;
}

export interface ExtractedSavingsResults {
  postAtlasAnnualKwh?: number;
  preAtlasAvgPowerKw?: number;
  postAtlasAvgPowerKw?: number;
  postAtlasPeakDemandKw?: number;
  dsCompressorFlexibilityPct?: number;
}

export interface ExtractedSiteContact {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface BaselineExtraction {
  equipment?: ExtractedEquipment[];
  energyData?: ExtractedEnergyData[];
  touSchedule?: ExtractedTouSchedule;
  rateStructure?: ExtractedRateStructure;
  operationalParams?: ExtractedOperationalParams;
  operations?: ExtractedOperations;
  labor?: ExtractedLabor;
  savingsResults?: ExtractedSavingsResults;
  siteContacts?: ExtractedSiteContact[];
  confidence: number;
  notes: string;
  summary: string;
  sectionsFound: string[];
}

// ─── System Prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI assistant for CrossnoKaye (CK), a company that deploys ATLAS industrial monitoring systems at cold storage and refrigeration facilities.

You are analyzing an uploaded document to extract structured baseline data for a site assessment. The document could be:
- A utility bill (electricity) → extract energy consumption, costs, rates, provider info, TOU periods
- An equipment list, P&ID, or nameplate photo → extract equipment details (compressors, condensers, evaporators, etc.)
- Operational documentation → extract system parameters, refrigerant type, operating hours, pressures
- Staffing/labor documents → extract headcount, roles, hours
- Interval data or spreadsheets → extract monthly consumption patterns

Respond with a JSON object (no markdown fences) with these fields. Only include sections where you found relevant data:

{
  "equipment": [
    {
      "category": "compressor|condenser|evaporator|vessel|vfd|pump|controls|other",
      "name": "e.g. C-1",
      "manufacturer": "e.g. Frick",
      "model": "e.g. RWB-II-222",
      "quantity": 1,
      "specs": {
        "type": "screw|reciprocating|rotary (for compressors)",
        "hp": 570,
        "loop": "low|high|blast",
        "loading_summer": 1.0,
        "loading_shoulder": 0.75,
        "loading_winter": 0.0,
        "suction_setpoint_psig": 6.5,
        "discharge_setpoint_psig": 120
      },
      "notes": "any additional context"
    }
  ],
  "energyData": [
    {
      "periodMonth": "2024-01-01",
      "totalCharges": 45000.00,
      "totalKwh": 450000,
      "peakDemandKw": 1200,
      "supplyCharges": 25000,
      "distributionCharges": 18000,
      "onPeakKwh": 200000,
      "offPeakKwh": 250000,
      "shoulderKwh": null,
      "onPeakDemandKw": 1200,
      "offPeakDemandKw": 800,
      "capacityPlcKw": 900,
      "transmissionPlcKw": 850,
      "salesTax": 2000
    }
  ],
  "touSchedule": {
    "supplyProvider": "Constellation",
    "distributionProvider": "Delmarva Power",
    "onPeakEnergyRate": 0.08,
    "onPeakDemandRate": 12.50,
    "onPeakStartHour": 8,
    "onPeakEndHour": 21,
    "onPeakMonths": "Jun-Sep",
    "offPeakEnergyRate": 0.05,
    "offPeakDemandRate": 6.00,
    "shoulderEnergyRate": 0.06,
    "shoulderDemandRate": 8.00,
    "shoulderStartHour": 7,
    "shoulderEndHour": 22,
    "shoulderMonths": "Apr-May, Oct-Nov"
  },
  "rateStructure": {
    "fixedUsagePct": 0.15,
    "variableTouUsagePct": 0.30,
    "maxDemandPct": 0.20,
    "variableTouDemandPct": 0.10,
    "coincidentPeakPct": 0.20,
    "otherFixedPct": 0.05,
    "cpZone": "PJM_DPL",
    "avgCpTagKw": 900,
    "capacityRatePerKwYr": 85.00,
    "transmissionRatePerKwYr": 45.00
  },
  "operationalParams": {
    "operatingDaysPerWeek": 7,
    "dailyOperationalHours": 24,
    "loadFactor": 0.85,
    "systemType": "two_stage",
    "refrigerant": "ammonia",
    "controlSystem": "Frick",
    "controlHardware": "Opto 22",
    "facilityType": "cold_storage",
    "runs247": true,
    "hasSubMetering": false,
    "hasBlastFreezing": true
  },
  "operations": {
    "dischargePressureTypical": 120,
    "suctionPressureTypical": 6.5,
    "canShedLoad": true,
    "canShutdown": false,
    "shutdownConstraints": "System finicky on restart",
    "curtailmentEnrolled": true,
    "seasonalityNotes": "Peak load Jun-Aug",
    "staffingNotes": "No dedicated refrigeration engineer"
  },
  "labor": {
    "headcount": [
      {"role": "operator", "count": 3, "hoursPerWeek": 40},
      {"role": "maintenance_tech", "count": 1, "hoursPerWeek": 40}
    ],
    "painPoints": "Manual monitoring of compressor pressures",
    "manualProcesses": "Hourly round sheets, manual defrost scheduling"
  },
  "confidence": 0.85,
  "notes": "Extracted from March 2024 utility bill. Some rate fields estimated from line items.",
  "sectionsFound": ["energyData", "touSchedule", "rateStructure"]
}

Rules:
- Include a "summary" field (1-2 sentences, max 150 chars) describing what the document contains and key data points found. Example: "12 months of 15-min interval kW data (Jan-Dec 2025). Peak demand: 1,247 kW."
- Only include sections where you found clear data. Don't guess or fabricate values.
- For utility bills, extract ALL visible line items including on-peak/off-peak breakdowns.
- For equipment, use the correct category and include all nameplate data visible.
- Set confidence between 0-1 based on clarity of the data (1.0 = perfectly clear, 0.5 = partially readable).
- Include "sectionsFound" listing which top-level sections have data.
- Period months should be formatted as "YYYY-MM-01" (first of the month).
- Dollar amounts should NOT include $ signs — just numbers.
- Rates should be in $/kWh or $/kW as appropriate.
- For photos of equipment nameplates, extract manufacturer, model, HP, voltage, amps if visible.`;

// ─── Extraction Function ──────────────────────────────────────────────

/**
 * Extract baseline data from a document using Claude.
 *
 * @param content - Document content as base64 (for images/PDFs) or plain text (for CSV/text)
 * @param mimeType - MIME type of the document
 * @param fileName - Original filename for context
 * @param existingContext - Optional context about what data already exists
 */
export async function extractBaseline(
  content: string,
  mimeType: string,
  fileName: string,
  existingContext?: string,
  pageImages?: string[],
): Promise<BaselineExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Build the user message content blocks
  const userContent: unknown[] = [];

  // Page images (PDF rendered as JPEGs, or standalone images)
  if (pageImages && pageImages.length > 0) {
    for (const imgBase64 of pageImages) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: imgBase64,
        },
      });
    }
  } else if (mimeType.startsWith("image/")) {
    // Single image sent as content string
    userContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: content,
      },
    });
  }

  // Add text context
  let textPrompt = `Analyze this document and extract baseline assessment data.\n\nFile: ${fileName}`;
  if (pageImages && pageImages.length > 0) {
    textPrompt += `\n\n[${pageImages.length} page(s) rendered as images from a PDF document]`;
  }
  if (existingContext) {
    textPrompt += `\n\nCategory-specific instructions: ${existingContext}`;
  }

  // For text-based documents, include the content directly
  if (content && (mimeType.startsWith("text/") || mimeType === "application/csv")) {
    textPrompt += `\n\nDocument content:\n${content}`;
  }

  userContent.push({ type: "text", text: textPrompt });

  // Direct fetch to Anthropic API (avoids SDK compatibility issues on Cloudflare Workers)
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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text();
    throw new Error(`Anthropic API error (${anthropicRes.status}): ${errBody}`);
  }

  const response = await anthropicRes.json() as { content: { type: string; text: string }[] };
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
    throw new Error(`Failed to parse Claude extraction response: ${textBlock.text.slice(0, 200)}`);
  }
}
