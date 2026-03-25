/**
 * Deepgram Voice Agent API configuration builder.
 * Creates the Settings message for the WebSocket connection.
 */

import { buildInterviewPrompt } from "./interview-prompts";
import { INTERVIEW_FUNCTIONS } from "./interview-functions";

export interface AgentConfigContext {
  siteName: string;
  customerName: string;
  existingData?: Record<string, unknown>;
  anthropicApiKey?: string;
}

/**
 * Build the Deepgram Voice Agent Settings message.
 * This is sent immediately after WebSocket connection is established.
 */
export function buildAgentSettings(context: AgentConfigContext) {
  const systemPrompt = buildInterviewPrompt(context);

  // BYO Anthropic API key with explicit endpoint
  // Use claude-3-haiku (confirmed existing model) for lowest latency
  const thinkConfig: Record<string, unknown> = {
    provider: {
      type: "anthropic",
      model: "claude-3-5-haiku-20241022",
    },
    prompt: systemPrompt,
    functions: INTERVIEW_FUNCTIONS,
  };

  if (context.anthropicApiKey) {
    thinkConfig.endpoint = {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": context.anthropicApiKey,
      },
    };
  }

  return {
    type: "Settings",
    audio: {
      input: {
        encoding: "linear16",
        sample_rate: 24000,
      },
      output: {
        encoding: "linear16",
        sample_rate: 24000,
        container: "none",
      },
    },
    agent: {
      language: "en",
      listen: {
        provider: {
          type: "deepgram",
          model: "nova-3",
          keyterms: [
            "CrossnoKaye", "ATLAS", "Frick", "Mycom", "GEA", "Sabroe", "Vilter",
            "BAC", "Evapco", "ammonia", "R-717", "R-404A", "R-507", "R-22",
            "screw compressor", "reciprocating", "evaporative condenser",
            "suction", "discharge", "psig", "kWh", "demand response",
            "PJM", "ERCOT", "coincident peak", "PLC tag",
          ],
        },
      },
      think: thinkConfig,
      speak: {
        provider: {
          type: "deepgram",
          model: "aura-2-thalia-en",
        },
      },
      greeting: buildGreeting(context),
    },
  };
}

/** Build a context-aware greeting based on existing site data */
function buildGreeting(context: AgentConfigContext): string {
  const contacts = context.existingData?.contacts as { name: string; title?: string }[] | undefined;
  const intro = `Hi there! I'm the ATLAS interview assistant from CrossnoKaye. I'm here to learn about the refrigeration system at ${context.siteName} so we can identify energy saving opportunities. This usually takes about 20 to 30 minutes.`;

  if (contacts && contacts.length > 0) {
    const names = contacts.map((c) => c.title ? `${c.name}, ${c.title}` : c.name).join(", and ");
    return `${intro} I see we have ${names} on file for this site. Is that who I'm speaking with today? Anyone else joining us?`;
  }

  return `${intro} Let's start — can you tell me who's in the room today and your roles at the facility?`;
}

/**
 * Get the Deepgram WebSocket URL for the Voice Agent API.
 */
export function getAgentWebSocketUrl(apiKey: string): string {
  return `wss://agent.deepgram.com/v1/agent/converse`;
}

/**
 * Build WebSocket connection headers/protocols.
 */
export function getAgentProtocols(apiKey: string): string[] {
  return ["token", apiKey];
}
