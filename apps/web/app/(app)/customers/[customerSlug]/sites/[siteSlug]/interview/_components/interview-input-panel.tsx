"use client";

import { useState } from "react";
import { Mic, Keyboard, MicOff } from "lucide-react";
import { Button } from "../../../../../../../../components/ui/button";
import type { InputMode } from "../../../../../../../../lib/interview/interview-types";

interface Props {
  inputMode: InputMode;
  micLevel: number;
  onModeChange: (mode: InputMode) => void;
  onSendMessage: (text: string) => void;
}

export function InterviewInputPanel({
  inputMode,
  micLevel,
  onModeChange,
  onSendMessage,
}: Props) {
  const [freeText, setFreeText] = useState("");

  const handleSendFreeText = () => {
    if (!freeText.trim()) return;
    onSendMessage(freeText.trim());
    setFreeText("");
  };

  const showTextInput = inputMode === "text" || inputMode === "hybrid";
  const showMicViz = inputMode === "voice" || inputMode === "hybrid";

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
          <ModeButton
            active={inputMode === "voice"}
            onClick={() => onModeChange("voice")}
            label="Voice"
            icon={<Mic className="h-3.5 w-3.5" />}
          />
          <ModeButton
            active={inputMode === "text"}
            onClick={() => onModeChange("text")}
            label="Type"
            icon={<Keyboard className="h-3.5 w-3.5" />}
          />
          <ModeButton
            active={inputMode === "hybrid"}
            onClick={() => onModeChange("hybrid")}
            label="Both"
            icon={
              <span className="flex items-center gap-0.5">
                <Mic className="h-3 w-3" />
                <Keyboard className="h-3 w-3" />
              </span>
            }
          />
        </div>

        {/* Mic status indicator */}
        {showMicViz && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-gray-400">Mic on</span>
          </div>
        )}
        {inputMode === "text" && (
          <div className="flex items-center gap-1.5">
            <MicOff className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-400">Mic paused</span>
          </div>
        )}
      </div>

      {/* Voice-only: mic visualization */}
      {inputMode === "voice" && (
        <div className="px-4 pb-3 flex items-center justify-center gap-2">
          <div className="flex items-end gap-0.5 h-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-sm transition-all ${
                  micLevel > i * 25 ? "bg-red-500" : "bg-red-200"
                }`}
                style={{ height: `${40 + i * 20}%` }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400">Speak naturally — the agent is listening</span>
        </div>
      )}

      {/* Text input area */}
      {showTextInput && (
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSendFreeText(); }
              }}
              placeholder="Type a message to the agent..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30 focus:border-green-500"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSendFreeText}
              disabled={!freeText.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mode Toggle Button ──────────────────────────────

function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
