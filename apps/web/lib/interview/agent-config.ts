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
}

/**
 * Build the Deepgram Voice Agent Settings message.
 * This is sent immediately after WebSocket connection is established.
 */
export function buildAgentSettings(context: AgentConfigContext) {
  const systemPrompt = buildInterviewPrompt(context);

  return {
    type: "Settings",
    audio: {
      input: {
        encoding: "linear16",
        sample_rate: 16000,
      },
      output: {
        encoding: "linear16",
        sample_rate: 16000,
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
      think: {
        provider: {
          type: "anthropic",
          model: "claude-4-5-haiku-latest",
        },
        prompt: systemPrompt,
        functions: INTERVIEW_FUNCTIONS,
      },
      speak: {
        provider: {
          type: "deepgram",
          model: "aura-2-thalia-en",
        },
      },
      greeting: `Hi there! I'm the ATLAS interview assistant from CrossnoKaye. I'm here to learn about the refrigeration system at ${context.siteName} so we can identify energy saving opportunities. This usually takes about 20 to 30 minutes. Let's start — can you tell me who's in the room today and your roles at the facility?`,
    },
  };
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
