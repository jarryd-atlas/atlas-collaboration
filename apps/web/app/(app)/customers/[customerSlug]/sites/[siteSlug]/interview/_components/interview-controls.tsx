"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../../../../../../components/ui/button";
import { PhoneOff, Mic, MicOff } from "lucide-react";

interface Props {
  status: string;
  agentState: "idle" | "listening" | "thinking" | "speaking";
  micLevel: number; // 0-100
  onEnd: () => void;
}

export function InterviewControls({ status, agentState, micLevel, onEnd }: Props) {
  const [showMuteWarning, setShowMuteWarning] = useState(false);
  const [silenceStart, setSilenceStart] = useState<number | null>(null);

  // Detect sustained silence (mic muted or not working)
  useEffect(() => {
    if (status !== "active") return;

    if (micLevel < 2) {
      if (!silenceStart) {
        setSilenceStart(Date.now());
      } else if (Date.now() - silenceStart > 5000) {
        setShowMuteWarning(true);
      }
    } else {
      setSilenceStart(null);
      setShowMuteWarning(false);
    }
  }, [micLevel, status, silenceStart]);

  // Volume bar levels (4 bars)
  const bars = [
    micLevel > 5,
    micLevel > 20,
    micLevel > 45,
    micLevel > 70,
  ];

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

      {/* Mic indicator with volume bars */}
      {status === "active" && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-50 border border-red-200">
          {showMuteWarning ? (
            <MicOff className="h-3 w-3 text-red-500" />
          ) : (
            <Mic className="h-3 w-3 text-red-500" />
          )}
          {/* 4-bar volume meter */}
          <div className="flex items-end gap-px h-3">
            {bars.map((active, i) => (
              <div
                key={i}
                className={`w-1 rounded-sm transition-all duration-75 ${
                  active ? "bg-red-500" : "bg-red-200"
                }`}
                style={{ height: `${40 + i * 20}%` }}
              />
            ))}
          </div>
          <span className="text-xs text-red-600 font-medium">
            {showMuteWarning ? "Muted?" : "Live"}
          </span>
        </div>
      )}

      {/* Mute warning banner */}
      {showMuteWarning && (
        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 animate-pulse">
          Check your microphone
        </span>
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
