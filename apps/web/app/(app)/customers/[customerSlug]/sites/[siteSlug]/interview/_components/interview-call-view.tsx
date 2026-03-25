"use client";

import { useState, useEffect, useRef } from "react";
import { Mic } from "lucide-react";

interface Props {
  agentState: "idle" | "listening" | "thinking" | "speaking";
  micLevel: number; // 0-1
  latestAgentText: string;
  durationSec: number;
}

export function InterviewCallView({ agentState, micLevel, latestAgentText, durationSec }: Props) {
  const [captionVisible, setCaptionVisible] = useState(false);
  const [displayedCaption, setDisplayedCaption] = useState("");
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show caption when agent text arrives, auto-fade after agent stops speaking
  useEffect(() => {
    if (latestAgentText) {
      setDisplayedCaption(latestAgentText);
      setCaptionVisible(true);
      // Clear any existing fade timer
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    }
  }, [latestAgentText]);

  // Auto-fade caption 5s after agent stops speaking
  useEffect(() => {
    if (agentState !== "speaking" && captionVisible) {
      fadeTimerRef.current = setTimeout(() => setCaptionVisible(false), 5000);
      return () => {
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      };
    }
  }, [agentState, captionVisible]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Ring colors based on state
  const ringColor =
    agentState === "speaking"
      ? "border-green-400 shadow-green-200/50"
      : agentState === "thinking"
      ? "border-yellow-400 shadow-yellow-200/50"
      : agentState === "listening"
      ? "border-red-400 shadow-red-200/50"
      : "border-gray-300";

  const ringPulse =
    agentState === "speaking" || agentState === "thinking" ? "animate-pulse" : "";

  // Mic ring scale based on mic level when listening
  const micRingScale = agentState === "listening" ? 1 + micLevel * 0.15 : 1;

  const stateLabel =
    agentState === "speaking"
      ? "ATLAS is speaking..."
      : agentState === "thinking"
      ? "Processing..."
      : agentState === "listening"
      ? "Listening..."
      : "Ready";

  const stateDotColor =
    agentState === "speaking"
      ? "bg-green-500"
      : agentState === "thinking"
      ? "bg-yellow-500"
      : agentState === "listening"
      ? "bg-red-400"
      : "bg-gray-300";

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative">
      {/* Call Status Hub */}
      <div className="flex flex-col items-center gap-4">
        {/* Audio visualizer ring */}
        <div
          className={`w-28 h-28 rounded-full border-4 ${ringColor} ${ringPulse} shadow-lg flex items-center justify-center transition-all duration-300`}
          style={{ transform: `scale(${micRingScale})` }}
        >
          <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
            <Mic
              className={`h-8 w-8 ${
                agentState === "listening" ? "text-red-500" : "text-gray-400"
              }`}
            />
          </div>
        </div>

        {/* State label */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stateDotColor} ${
            agentState !== "idle" ? "animate-pulse" : ""
          }`} />
          <span className="text-sm text-gray-500 font-medium">{stateLabel}</span>
        </div>

        {/* Timer */}
        <span className="text-xs font-mono text-gray-400">{formatTime(durationSec)}</span>
      </div>

      {/* Live Caption Bar */}
      <div
        className={`absolute bottom-4 left-4 right-4 transition-opacity duration-500 ${
          captionVisible && displayedCaption ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-3 max-h-24 overflow-y-auto">
          <p className="text-sm text-white/90 leading-relaxed">{displayedCaption}</p>
        </div>
      </div>
    </div>
  );
}
