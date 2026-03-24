"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../../../../../../../../lib/interview/interview-types";
import { Loader2 } from "lucide-react";

interface Props {
  transcript: TranscriptEntry[];
  agentState: "idle" | "listening" | "thinking" | "speaking";
}

export function InterviewTranscript({ transcript, agentState }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length, agentState]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Agent status indicator */}
      {transcript.length === 0 && agentState === "idle" && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎙</span>
          </div>
          <p className="text-gray-400 text-sm">Waiting for ATLAS agent to begin...</p>
        </div>
      )}

      {/* Transcript entries */}
      {transcript.map((entry, i) => (
        <div
          key={i}
          className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              entry.role === "user"
                ? "bg-gray-900 text-white rounded-br-md"
                : "bg-gray-100 text-gray-900 rounded-bl-md"
            }`}
          >
            <p className="text-sm leading-relaxed">{entry.text}</p>
            <span className={`text-[10px] mt-1 block ${
              entry.role === "user" ? "text-gray-400" : "text-gray-400"
            }`}>
              {entry.role === "agent" ? "ATLAS" : "You"} · {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      ))}

      {/* Agent typing/thinking indicator */}
      {agentState === "thinking" && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>ATLAS is thinking...</span>
            </div>
          </div>
        </div>
      )}

      {/* Agent speaking indicator */}
      {agentState === "speaking" && (
        <div className="flex justify-start">
          <div className="bg-green-50 border border-green-200 rounded-2xl rounded-bl-md px-4 py-2">
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: "300ms" }} />
              </span>
              <span>Speaking...</span>
            </div>
          </div>
        </div>
      )}

      {/* Listening indicator */}
      {agentState === "listening" && transcript.length > 0 && (
        <div className="flex justify-center">
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Listening...
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
