"use client";

import { useState } from "react";
import { Mic, FileAudio } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogHeader, DialogBody } from "../../../components/ui/dialog";
import { VoiceRecorder } from "../../../components/voice/voice-recorder";
import { VoiceNoteCard } from "../../../components/voice/voice-note-card";
import { getVoiceNotes } from "../../../lib/mock-data";
import type { VoiceNoteStatus } from "../../../lib/mock-data";

type FilterStatus = "all" | "ready" | "processing";

export default function VoiceNotesPage() {
  const [showRecorder, setShowRecorder] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");

  const allNotes = getVoiceNotes();

  const filteredNotes = allNotes.filter((note) => {
    if (filter === "all") return true;
    if (filter === "ready") return note.status === "ready";
    if (filter === "processing")
      return note.status === "uploading" || note.status === "transcribing" || note.status === "summarizing";
    return true;
  });

  const handleRecordingComplete = (blob: Blob, durationSeconds: number) => {
    // In production, this would call uploadVoiceNote server action
    console.log("Recording complete:", { size: blob.size, durationSeconds });
    setShowRecorder(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Notes</h1>
          <p className="text-gray-500 mt-1">Record and review voice notes with AI transcription</p>
        </div>
        <Button onClick={() => setShowRecorder(true)} className="gap-2">
          <Mic className="h-4 w-4" />
          Record
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["all", "ready", "processing"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {status === "all" ? "All" : status === "ready" ? "Ready" : "Processing"}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <FileAudio className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">No voice notes</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            {filter === "all"
              ? "Record your first voice note to get started. AI will automatically transcribe and extract action items."
              : `No ${filter} voice notes found.`}
          </p>
          {filter === "all" && (
            <Button onClick={() => setShowRecorder(true)} className="mt-4 gap-2">
              <Mic className="h-4 w-4" />
              Record Note
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredNotes.map((note) => (
            <VoiceNoteCard key={note.id} note={note} />
          ))}
        </div>
      )}

      {/* Record dialog */}
      <Dialog open={showRecorder} onClose={() => setShowRecorder(false)} className="max-w-md">
        <DialogHeader onClose={() => setShowRecorder(false)}>Record Voice Note</DialogHeader>
        <DialogBody>
          <VoiceRecorder onRecordingComplete={handleRecordingComplete} />
        </DialogBody>
      </Dialog>
    </div>
  );
}
