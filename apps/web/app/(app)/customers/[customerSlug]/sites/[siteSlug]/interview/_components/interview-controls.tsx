"use client";

import { Button } from "../../../../../../../../components/ui/button";
import { Phone, PhoneOff, Mic } from "lucide-react";

interface Props {
  status: string;
  agentState: "idle" | "listening" | "thinking" | "speaking";
  onEnd: () => void;
}

export function InterviewControls({ status, agentState, onEnd }: Props) {
  return (
    <div className="flex items-center gap-3">
      {/* Agent state indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            agentState === "speaking"
              ? "bg-green-500 animate-pulse"
              : agentState === "thinking"
              ? "bg-yellow-500 animate-pulse"
              : agentState === "listening"
              ? "bg-red-400 animate-pulse"
              : "bg-gray-300"
          }`}
        />
        <span className="text-xs text-gray-500 capitalize">
          {agentState === "speaking"
            ? "Agent speaking"
            : agentState === "thinking"
            ? "Processing..."
            : agentState === "listening"
            ? "Listening"
            : "Ready"}
        </span>
      </div>

      {/* Mic indicator */}
      {status === "active" && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 border border-red-200">
          <Mic className="h-3 w-3 text-red-500" />
          <span className="text-xs text-red-600 font-medium">Live</span>
        </div>
      )}

      {/* End button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onEnd}
        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
      >
        <PhoneOff className="h-4 w-4 mr-1" />
        End Interview
      </Button>
    </div>
  );
}
