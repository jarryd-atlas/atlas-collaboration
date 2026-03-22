"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, Sparkles, Check, X, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import { createTasksBatch } from "../../lib/actions";

interface ExtractedTask {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  _editing?: boolean;
  _editTitle?: string;
  _selected?: boolean;
}

interface VoiceTaskCreatorProps {
  milestoneId?: string;
  siteId?: string;
  tenantId: string;
  /** Context for AI to understand the domain */
  context?: {
    customerName?: string;
    siteName?: string;
    milestoneName?: string;
  };
  onDone?: () => void;
}

type Phase = "idle" | "recording" | "transcribing" | "extracting" | "review" | "saving";

/**
 * Voice-to-tasks: Record audio → transcribe → AI extracts tasks → review & approve.
 * Also supports text input for typing natural language that gets AI-extracted.
 */
export function VoiceTaskCreator({
  milestoneId,
  siteId,
  tenantId,
  context,
  onDone,
}: VoiceTaskCreatorProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [error, setError] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  async function startRecording() {
    try {
      setError("");
      setPhase("recording");
      setDuration(0);
      setTasks([]);
      setTranscript("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        await processAudioBlob(blob);
      };

      recorder.start(1000);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      setPhase("idle");
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access.");
      } else {
        setError("Failed to start recording.");
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function processAudioBlob(blob: Blob) {
    setPhase("transcribing");

    // For now, use browser's SpeechRecognition as a fallback if Deepgram isn't set up
    // In production, this would upload to storage → Deepgram API
    // For the MVP, we'll use a simulated transcription with the audio
    try {
      // Try Web Speech API for quick local transcription
      const transcriptText = await transcribeWithWebSpeech(blob);
      if (transcriptText) {
        setTranscript(transcriptText);
        await extractTasksFromText(transcriptText);
      } else {
        setError("Could not transcribe audio. Try typing your tasks instead.");
        setTextMode(true);
        setPhase("idle");
      }
    } catch {
      setError("Transcription failed. Try typing your tasks instead.");
      setTextMode(true);
      setPhase("idle");
    }
  }

  async function transcribeWithWebSpeech(_blob: Blob): Promise<string | null> {
    // Web Speech API doesn't work with blobs, it works in real-time
    // For now, return null and let the user use text mode
    // In production, this calls Deepgram or Whisper API
    return null;
  }

  async function extractTasksFromText(text: string) {
    setPhase("extracting");
    try {
      const res = await fetch("/api/ai/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context }),
      });

      if (!res.ok) throw new Error("AI extraction failed");

      const data = await res.json();
      const extracted = (data.tasks || []).map((t: ExtractedTask) => ({
        ...t,
        _selected: true,
      }));
      setTasks(extracted);
      setPhase("review");
    } catch {
      setError("Failed to extract tasks. Please try again.");
      setPhase("idle");
    }
  }

  async function handleTextSubmit() {
    if (!textInput.trim()) return;
    setTranscript(textInput.trim());
    await extractTasksFromText(textInput.trim());
  }

  function toggleTask(index: number) {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, _selected: !t._selected } : t)),
    );
  }

  function removeTask(index: number) {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function startEditTask(index: number) {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, _editing: true, _editTitle: t.title } : t,
      ),
    );
  }

  function saveEditTask(index: number) {
    setTasks((prev) =>
      prev.map((t, i) =>
        i === index
          ? { ...t, title: t._editTitle || t.title, _editing: false, _editTitle: undefined }
          : t,
      ),
    );
  }

  function updateEditTitle(index: number, value: string) {
    setTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, _editTitle: value } : t)),
    );
  }

  function cyclePriority(index: number) {
    const order: ExtractedTask["priority"][] = ["low", "medium", "high", "urgent"];
    setTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const nextIdx = (order.indexOf(t.priority) + 1) % order.length;
        return { ...t, priority: order[nextIdx]! };
      }),
    );
  }

  async function handleApprove() {
    const selected = tasks.filter((t) => t._selected !== false);
    if (selected.length === 0) return;

    setPhase("saving");
    const batch = selected.map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
      milestoneId,
      siteId,
      tenantId,
    }));

    const result = await createTasksBatch(batch);
    if ("error" in result) {
      setError(result.error ?? "Failed to create tasks");
      setPhase("review");
    } else {
      router.refresh();
      onDone?.();
      // Reset
      setPhase("idle");
      setTasks([]);
      setTranscript("");
      setTextInput("");
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const priorityColors: Record<string, string> = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-blue-50 text-blue-700",
    high: "bg-amber-50 text-amber-700",
    urgent: "bg-red-50 text-red-700",
  };

  const selectedCount = tasks.filter((t) => t._selected !== false).length;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-green" />
          <h3 className="text-sm font-semibold text-gray-900">AI Task Creator</h3>
        </div>
        {phase === "idle" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTextMode(!textMode)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              {textMode ? "Use voice" : "Type instead"}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="p-5">
        {/* Idle / Input Phase */}
        {phase === "idle" && !textMode && (
          <div className="flex flex-col items-center py-6 gap-4">
            <p className="text-sm text-gray-500 text-center max-w-xs">
              Describe your tasks by voice. AI will extract and organize them for you.
            </p>
            <button
              onClick={startRecording}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-all hover:scale-105 active:scale-95"
              aria-label="Start recording"
            >
              <Mic className="h-6 w-6" />
            </button>
          </div>
        )}

        {phase === "idle" && textMode && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Type your tasks in natural language. AI will extract and organize them.
            </p>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="e.g. We need to install sensors in Zone B, configure the alerting thresholds for temperature, and schedule a training session with the ops team next week. The sensor installation is urgent."
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 resize-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className="gap-2"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Extract Tasks
              </Button>
            </div>
          </div>
        )}

        {/* Recording Phase */}
        {phase === "recording" && (
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="text-3xl font-mono font-bold text-gray-900 tabular-nums">
              {formatTime(duration)}
            </div>
            <div className="flex items-center gap-2 text-sm text-red-600">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              Recording...
            </div>
            <button
              onClick={stopRecording}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-700 transition-all"
              aria-label="Stop recording"
            >
              <Square className="h-5 w-5 fill-current" />
            </button>
            <p className="text-xs text-gray-400">Click to stop and extract tasks</p>
          </div>
        )}

        {/* Processing Phases */}
        {(phase === "transcribing" || phase === "extracting") && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 text-brand-green animate-spin" />
            <p className="text-sm font-medium text-gray-700">
              {phase === "transcribing" ? "Transcribing audio..." : "AI is extracting tasks..."}
            </p>
            <p className="text-xs text-gray-400">This usually takes a few seconds</p>
          </div>
        )}

        {/* Review Phase */}
        {phase === "review" && (
          <div className="space-y-4">
            {/* Source transcript */}
            {transcript && (
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs font-medium text-gray-400 mb-1">Source</p>
                <p className="text-sm text-gray-600 italic">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            {/* Extracted tasks */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""} extracted
              </p>
              <div className="space-y-1.5">
                {tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className={`group flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                      task._selected !== false
                        ? "border-gray-200 bg-white"
                        : "border-gray-100 bg-gray-50 opacity-50"
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTask(idx)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        task._selected !== false
                          ? "border-brand-green bg-brand-green text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {task._selected !== false && <Check className="h-3 w-3" />}
                    </button>

                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      {task._editing ? (
                        <input
                          value={task._editTitle ?? task.title}
                          onChange={(e) => updateEditTitle(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditTask(idx);
                            if (e.key === "Escape") saveEditTask(idx);
                          }}
                          onBlur={() => saveEditTask(idx)}
                          autoFocus
                          className="w-full text-sm text-gray-900 bg-transparent border-b border-brand-green/50 focus:outline-none py-0.5"
                        />
                      ) : (
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                      )}
                      {task.description && !task._editing && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{task.description}</p>
                      )}
                    </div>

                    {/* Priority badge (clickable to cycle) */}
                    <button
                      onClick={() => cyclePriority(idx)}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${priorityColors[task.priority] ?? "bg-gray-100 text-gray-600"}`}
                      title="Click to change priority"
                    >
                      {task.priority}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => startEditTask(idx)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400"
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeTask(idx)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setPhase("idle");
                  setTasks([]);
                  setTranscript("");
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Start over
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {selectedCount} of {tasks.length} selected
                </span>
                <Button
                  onClick={handleApprove}
                  disabled={selectedCount === 0}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Create {selectedCount} Task{selectedCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Saving Phase */}
        {phase === "saving" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 text-brand-green animate-spin" />
            <p className="text-sm font-medium text-gray-700">Creating tasks...</p>
          </div>
        )}
      </div>
    </div>
  );
}
