"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Combobox } from "../ui/combobox";
import type { ComboboxOption } from "../ui/combobox";
import { Button } from "../ui/button";
import { uploadVoiceNote, fetchSitesWithMilestones } from "../../lib/actions";

interface VoiceRecordDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill site association (e.g. when recording from a site page) */
  defaultSiteId?: string;
  /** Pre-fill milestone association */
  defaultMilestoneId?: string;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

interface SiteOption {
  id: string;
  name: string;
  milestones: { id: string; name: string }[];
}

export function VoiceRecordDialog({
  open,
  onClose,
  defaultSiteId,
  defaultMilestoneId,
}: VoiceRecordDialogProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId ?? "");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(defaultMilestoneId ?? "");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const router = useRouter();

  // Fetch sites when dialog opens
  useEffect(() => {
    if (!open) return;
    fetchSitesWithMilestones().then((result) => {
      if (!result.error && result.sites) {
        const mapped = (result.sites as any[]).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          milestones: (s.milestones as { id: string; name: string }[]) || [],
        }));
        setSites(mapped);
      }
    });
  }, [open]);

  // Apply defaults when sites load
  useEffect(() => {
    if (defaultSiteId && !selectedSiteId) {
      setSelectedSiteId(defaultSiteId);
    }
    if (defaultMilestoneId && !selectedMilestoneId) {
      setSelectedMilestoneId(defaultMilestoneId);
    }
  }, [defaultSiteId, defaultMilestoneId, selectedSiteId, selectedMilestoneId]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);
  const milestones = selectedSite?.milestones || [];

  // Build combobox options
  const siteOptions: ComboboxOption[] = sites.map((s) => ({
    value: s.id,
    label: s.name,
    sublabel: `${s.milestones.length} milestone${s.milestones.length !== 1 ? "s" : ""}`,
  }));

  const milestoneOptions: ComboboxOption[] = milestones.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  // Clear milestone when site changes
  function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    if (siteId) {
      const newSite = sites.find((s) => s.id === siteId);
      const milestoneStillValid = newSite?.milestones.some((m) => m.id === selectedMilestoneId);
      if (!milestoneStillValid) setSelectedMilestoneId("");
    } else {
      setSelectedMilestoneId("");
    }
  }

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, [stopTimer]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      cleanup();
      setRecordingState("idle");
      setDuration(0);
      setError("");
      setAudioBlob(null);
      setSelectedSiteId(defaultSiteId ?? "");
      setSelectedMilestoneId(defaultMilestoneId ?? "");
    }
  }, [open, cleanup, defaultSiteId, defaultMilestoneId]);

  async function startRecording() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setRecordingState("stopped");
        stopTimer();
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(1000);
      setRecordingState("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        setError("Failed to start recording. Please check your microphone.");
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!audioBlob) return;

    setError("");
    setUploading(true);

    const formEl = e.currentTarget;
    const title = (new FormData(formEl).get("title") as string) || `Voice Note ${new Date().toLocaleDateString()}`;

    const formData = new FormData();
    formData.set("audio", new File([audioBlob], `recording-${Date.now()}.webm`, { type: audioBlob.type }));
    formData.set("title", title);
    formData.set("duration", String(duration));
    if (selectedSiteId) formData.set("siteId", selectedSiteId);
    if (selectedMilestoneId) formData.set("milestoneId", selectedMilestoneId);

    const result = await uploadVoiceNote(formData);
    setUploading(false);

    if ("error" in result) {
      setError(result.error ?? "Upload failed");
    } else {
      onClose();
      router.refresh();
      if (result.id) {
        router.push(`/voice-notes/${result.id}`);
      }
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const prefilledSiteName = defaultSiteId ? sites.find((s) => s.id === defaultSiteId)?.name : null;

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleUpload}>
        <DialogHeader onClose={onClose}>Record Voice Note</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Context indicator when opened from a site/milestone page */}
          {prefilledSiteName && recordingState === "idle" && (
            <div className="rounded-lg bg-brand-green/5 border border-brand-green/20 px-3 py-2 text-sm text-gray-700">
              Recording for <span className="font-medium">{prefilledSiteName}</span>
            </div>
          )}

          {/* Recording UI */}
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="text-3xl font-mono font-bold text-gray-900 tabular-nums">
              {formatTime(duration)}
            </div>

            {recordingState === "recording" && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                Recording...
              </div>
            )}
            {recordingState === "stopped" && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Recording complete
              </div>
            )}

            <div className="flex items-center gap-3">
              {recordingState === "idle" && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                  aria-label="Start recording"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <line x1="12" x2="12" y1="19" y2="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              {recordingState === "recording" && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-700 transition-colors"
                  aria-label="Stop recording"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                </button>
              )}
              {recordingState === "stopped" && (
                <button
                  type="button"
                  onClick={() => {
                    setAudioBlob(null);
                    setDuration(0);
                    setRecordingState("idle");
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Re-record
                </button>
              )}
            </div>
          </div>

          {/* Metadata fields (shown after recording) */}
          {recordingState === "stopped" && (
            <>
              <Input
                id="vr-title"
                name="title"
                label="Title"
                placeholder={`Voice Note ${new Date().toLocaleDateString()}`}
              />
              {sites.length > 0 && (
                <Combobox
                  id="vr-site"
                  label="Link to Site (optional)"
                  placeholder="Search sites..."
                  options={siteOptions}
                  value={selectedSiteId}
                  onChange={handleSiteChange}
                />
              )}
              {milestones.length > 0 && (
                <Combobox
                  id="vr-milestone"
                  label="Link to Milestone (optional)"
                  placeholder="Search milestones..."
                  options={milestoneOptions}
                  value={selectedMilestoneId}
                  onChange={setSelectedMilestoneId}
                />
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {recordingState === "stopped" && (
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Save Voice Note"}
            </Button>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}
