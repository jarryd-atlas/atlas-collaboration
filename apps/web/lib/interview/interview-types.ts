/** Interview agent types */

export type InterviewSection =
  | "welcome"
  | "facility_overview"
  | "refrigeration_system"
  | "controls"
  | "energy"
  | "operations"
  | "labor"
  | "wrap_up";

export const INTERVIEW_SECTIONS: { key: InterviewSection; label: string; icon: string }[] = [
  { key: "welcome", label: "Welcome & Contacts", icon: "👋" },
  { key: "facility_overview", label: "Facility Overview", icon: "🏭" },
  { key: "refrigeration_system", label: "Refrigeration System", icon: "❄️" },
  { key: "controls", label: "Controls & Automation", icon: "🎛️" },
  { key: "energy", label: "Energy & Utility", icon: "⚡" },
  { key: "operations", label: "Operations", icon: "⚙️" },
  { key: "labor", label: "Staffing & Labor", icon: "👷" },
  { key: "wrap_up", label: "Summary & Next Steps", icon: "✅" },
];

export interface TranscriptEntry {
  role: "agent" | "user";
  text: string;
  timestamp: number;
}

export interface CollectedField {
  section: string;
  label: string;
  value: string | number | boolean;
}

export type InputMode = "voice" | "text" | "hybrid";

export interface InterviewState {
  status: "connecting" | "ready" | "active" | "paused" | "ended" | "error";
  agentState: "idle" | "listening" | "thinking" | "speaking";
  currentSection: InterviewSection;
  transcript: TranscriptEntry[];
  collectedFields: Record<string, CollectedField[]>;
  progress: number; // 0-100
  durationSec: number;
  inputMode: InputMode;
  error?: string;
}

export interface SaveAnswerPayload {
  functionName: string;
  args: Record<string, unknown>;
  siteId: string;
  assessmentId: string;
  tenantId: string;
  interviewId: string;
}
