"use client";

import { useState } from "react";
import { INTERVIEW_SECTIONS } from "../../../../../../../../lib/interview/interview-types";
import type { InterviewSection, CollectedField } from "../../../../../../../../lib/interview/interview-types";
import { CheckCircle, Circle, Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "../../../../../../../../components/ui/button";

interface Props {
  currentSection: InterviewSection;
  collectedFields: Record<string, CollectedField[]>;
  progress: number;
  onSendNote?: (text: string) => void;
}

/** Map function names (without save_ prefix) to section keys */
const FUNCTION_TO_SECTION: Record<string, InterviewSection> = {
  site_contact: "welcome",
  operational_params: "facility_overview",
  equipment: "refrigeration_system",
  energy_info: "energy",
  operations_detail: "operations",
  labor_info: "labor",
};

export function InterviewSidebar({ currentSection, collectedFields, progress, onSendNote }: Props) {
  const [noteSection, setNoteSection] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const sectionHasData = (sectionKey: InterviewSection): boolean => {
    for (const [fnKey, sec] of Object.entries(FUNCTION_TO_SECTION)) {
      if (sec === sectionKey && collectedFields[fnKey]?.length) return true;
    }
    return false;
  };

  const sectionIndex = INTERVIEW_SECTIONS.findIndex((s) => s.key === currentSection);

  function handleSendNote(sectionKey: string) {
    if (!noteText.trim() || !onSendNote) return;
    onSendNote(`[Note for ${sectionKey}]: ${noteText.trim()}`);
    setNoteText("");
    setNoteSection(null);
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">Data Collected</h3>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 p-3 space-y-1">
        {INTERVIEW_SECTIONS.map((section, i) => {
          const isActive = section.key === currentSection;
          const isPast = i < sectionIndex;
          const hasData = sectionHasData(section.key);

          return (
            <div
              key={section.key}
              className={`rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-white border border-green-200 shadow-sm"
                  : isPast || hasData
                  ? "bg-white/50"
                  : "opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasData || isPast ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 text-green-500 animate-spin flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${isActive ? "text-gray-900" : "text-gray-600"}`}>
                    {section.icon} {section.label}
                  </span>
                </div>

                {/* Add note button */}
                {(isActive || hasData) && onSendNote && (
                  <button
                    onClick={() => setNoteSection(noteSection === section.key ? null : section.key)}
                    className="text-gray-400 hover:text-gray-600 p-0.5"
                    title="Add a typed note for this section"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Collected items */}
              {Object.entries(FUNCTION_TO_SECTION)
                .filter(([, sec]) => sec === section.key)
                .map(([fnKey]) => {
                  const items = collectedFields[fnKey] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={fnKey} className="mt-2 ml-6 space-y-1">
                      {items.map((item, j) => (
                        <div key={j} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="truncate">
                            <span className="font-medium text-gray-600">{item.label}</span>
                            {item.value && `: ${String(item.value)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}

              {/* Inline note input */}
              {noteSection === section.key && (
                <div className="mt-2 ml-6">
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendNote(section.key);
                        if (e.key === "Escape") { setNoteSection(null); setNoteText(""); }
                      }}
                      placeholder="Type a correction or note..."
                      className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendNote(section.key)}
                      className="text-xs px-2 py-1 h-auto"
                      disabled={!noteText.trim()}
                    >
                      Send
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    The agent will hear and incorporate your note
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
