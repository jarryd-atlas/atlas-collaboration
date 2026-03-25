"use client";

import { useRef, useEffect } from "react";
import type { TranscriptEntry } from "../../../../../../../../lib/interview/interview-types";

interface Props {
  transcript: TranscriptEntry[];
  durationSec: number;
}

export function InterviewDataPanel({ transcript, durationSec }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript.length]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const agentTurns = transcript.filter((t) => t.role === "agent").length;
  const userTurns = transcript.filter((t) => t.role === "user").length;

  return (
    <div className="w-[45%] min-w-[360px] border-l border-gray-200 bg-gray-50/30 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 text-sm">Transcript</h3>
          <span className="text-xs text-gray-400">{formatTime(durationSec)}</span>
        </div>
        <p className="text-xs text-gray-400">
          {transcript.length} turns · {userTurns} from you · {agentTurns} from agent
        </p>
      </div>

      {/* Transcript messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {transcript.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center mt-8">
            Conversation will appear here...
          </p>
        ) : (
          transcript.map((entry, i) => (
            <div
              key={i}
              className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  entry.role === "user"
                    ? "bg-green-600 text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                }`}
              >
                <p className="leading-relaxed">{entry.text}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    entry.role === "user" ? "text-green-200" : "text-gray-300"
                  }`}
                >
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
