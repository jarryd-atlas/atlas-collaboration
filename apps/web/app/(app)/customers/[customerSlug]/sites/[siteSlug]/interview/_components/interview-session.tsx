"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { buildAgentSettings } from "../../../../../../../../lib/interview/agent-config";
import type { InterviewState, TranscriptEntry, InputMode } from "../../../../../../../../lib/interview/interview-types";
import { InterviewCallView } from "./interview-call-view";
import { InterviewDataPanel } from "./interview-data-panel";
import { InterviewInputPanel } from "./interview-input-panel";
import { InterviewControls } from "./interview-controls";
import {
  Mic, MicOff, ArrowLeft, Loader2, CheckCircle, AlertCircle, BarChart3,
} from "lucide-react";
import { Button } from "../../../../../../../../components/ui/button";

interface PreviousInterview {
  id: string;
  analysis_summary: string | null;
  duration_sec: number;
  created_at: string;
}

interface Props {
  siteId: string;
  siteName: string;
  siteSlug: string;
  customerName: string;
  customerSlug: string;
  tenantId: string;
  assessmentId: string;
  existingData?: Record<string, unknown>;
  resumeSection?: string;
  deepgramApiKey: string;
  anthropicApiKey?: string;
  previousInterviews?: PreviousInterview[];
}

export function InterviewSession({
  siteId, siteName, siteSlug, customerName, customerSlug,
  tenantId, assessmentId, existingData, resumeSection,
  deepgramApiKey, anthropicApiKey, previousInterviews,
}: Props) {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micLevelFrameRef = useRef<number>(0);
  const playbackQueueRef = useRef<Int16Array[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingAgentTextRef = useRef<string[]>([]);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interviewIdRef = useRef<string | null>(null);

  const [micLevel, setMicLevel] = useState(0);
  const isMicMutedRef = useRef(false);

  const [state, setState] = useState<InterviewState>({
    status: "ready",
    agentState: "idle",
    currentSection: "welcome",
    transcript: [],
    collectedFields: {},
    progress: 0,
    durationSec: 0,
    inputMode: "voice",
  });

  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[Interview ${ts}]`, msg);
    setDebugLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // ─── Auto-save transcript to DB ─────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedLengthRef = useRef(0);

  const saveTranscript = useCallback((transcript: TranscriptEntry[], duration: number) => {
    if (!interviewIdRef.current) return;
    fetch("/api/interview/save-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        functionName: "_save_transcript",
        args: { transcript, fieldsCollected: {}, durationSec: duration },
        siteId, assessmentId, tenantId,
        interviewId: interviewIdRef.current,
      }),
    }).catch(() => {});
  }, [siteId, assessmentId, tenantId]);

  // ─── Audio Playback (gapless scheduling) ───────────────

  const nextPlayTimeRef = useRef(0);

  const playAudioChunk = useCallback((pcmData: Int16Array) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i]! / 32768;
    }
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    // Track active sources for barge-in cancellation
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  }, []);

  const processPlaybackQueue = useCallback(() => {
    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      playAudioChunk(chunk);
    }
  }, [playAudioChunk]);

  // ─── WebSocket Message Handler ─────────────────────────
  // No function call handling — transcript-only mode

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      const pcm = new Int16Array(event.data);
      playbackQueueRef.current.push(pcm);
      processPlaybackQueue();
      return;
    }

    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type !== "ConversationText" || msg.role === "assistant") {
        addLog(`← ${msg.type}${msg.message ? ": " + String(msg.message).slice(0, 80) : ""}${msg.description ? ": " + msg.description : ""}`);
      }

      switch (msg.type) {
        case "Welcome":
          addLog("WebSocket connected, sending Settings...");
          break;

        case "SettingsApplied":
          addLog("Settings accepted — agent ready");
          setState((prev) => ({ ...prev, status: "active", agentState: "idle" }));
          break;

        case "ConversationText": {
          const role = msg.role === "assistant" ? "agent" : "user";
          const text = msg.content ?? "";
          if (!text) break;

          if (role === "agent") {
            // Buffer agent text — only add to transcript when agent finishes speaking
            pendingAgentTextRef.current.push(text);
          } else {
            setState((prev) => {
              const last = prev.transcript[prev.transcript.length - 1];
              if (last && last.role === role && last.text === text) return prev;
              return {
                ...prev,
                transcript: [
                  ...prev.transcript,
                  { role, text, timestamp: Date.now() } as TranscriptEntry,
                ],
              };
            });
          }
          break;
        }

        case "AgentThinking":
          setState((prev) => ({ ...prev, agentState: "thinking" }));
          break;

        case "AgentStartedSpeaking":
          setState((prev) => ({ ...prev, agentState: "speaking" }));
          break;

        case "AgentAudioDone": {
          // Flush buffered agent text to transcript as a single entry
          const agentTexts = pendingAgentTextRef.current;
          pendingAgentTextRef.current = [];
          setState((prev) => {
            if (agentTexts.length === 0) return { ...prev, agentState: "listening" };
            // Deduplicate and join into one message
            const seen = new Set<string>();
            const unique = agentTexts.filter((t) => {
              if (seen.has(t)) return false;
              seen.add(t);
              return true;
            });
            return {
              ...prev,
              agentState: "listening",
              transcript: [
                ...prev.transcript,
                { role: "agent" as const, text: unique.join(" "), timestamp: Date.now() } as TranscriptEntry,
              ],
            };
          });
          break;
        }

        case "UserStartedSpeaking": {
          // Barge-in: immediately stop all agent audio
          playbackQueueRef.current = [];
          activeSourcesRef.current.forEach((s) => {
            try { s.stop(); } catch { /* already stopped */ }
          });
          activeSourcesRef.current = [];
          nextPlayTimeRef.current = 0;
          // Flush any buffered agent text before switching to listening
          const bargeTexts = pendingAgentTextRef.current;
          pendingAgentTextRef.current = [];
          setState((prev) => {
            const newTranscript = [...prev.transcript];
            if (bargeTexts.length > 0) {
              const seen = new Set<string>();
              const unique = bargeTexts.filter((t) => {
                if (seen.has(t)) return false;
                seen.add(t);
                return true;
              });
              newTranscript.push({ role: "agent" as const, text: unique.join(" "), timestamp: Date.now() } as TranscriptEntry);
            }
            return { ...prev, agentState: "listening", transcript: newTranscript };
          });
          break;
        }

        case "Error":
        case "Warning": {
          const errDetail = JSON.stringify(msg);
          addLog(`${msg.type}: ${errDetail}`);
          console.error("Deepgram error (full):", errDetail);
          if (msg.type === "Error") {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: msg.message ?? msg.description ?? msg.error ?? errDetail,
            }));
          }
          break;
        }
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, [processPlaybackQueue, addLog]);

  // ─── Start Interview ───────────────────────────────────

  const startInterview = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "connecting" }));

    try {
      // Create interview record
      const createRes = await fetch("/api/interview/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionName: "_create_interview",
          args: {},
          siteId, assessmentId, tenantId,
          interviewId: "",
        }),
      });
      const createResult = await createRes.json();
      if (createResult.interviewId) {
        interviewIdRef.current = createResult.interviewId;
      }

      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      // Create audio context
      const audioCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;

      // Build previous interview summaries for agent context
      const previousSummaries = previousInterviews
        ?.filter((pi) => pi.analysis_summary)
        .map((pi) => pi.analysis_summary!) ?? [];

      // Connect WebSocket
      const ws = new WebSocket(
        "wss://agent.deepgram.com/v1/agent/converse",
        ["token", deepgramApiKey],
      );
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const settings = buildAgentSettings({
          siteName,
          customerName,
          existingData,
          resumeSection,
          anthropicApiKey,
          previousInterviewSummaries: previousSummaries,
        });
        ws.send(JSON.stringify(settings));

        // Start mic streaming
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          if (isMicMutedRef.current) {
            int16.fill(0);
          } else {
            for (let i = 0; i < float32.length; i++) {
              const s = Math.max(-1, Math.min(1, float32[i]!));
              int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }
          }
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        // Mic level analyser
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const updateMicLevel = () => {
          if (!analyserRef.current) return;
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]!;
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMicLevel(level);
          micLevelFrameRef.current = requestAnimationFrame(updateMicLevel);
        };
        micLevelFrameRef.current = requestAnimationFrame(updateMicLevel);

        // Keep-alive
        keepAliveRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 7000);

        // Timer
        timerRef.current = setInterval(() => {
          setState((prev) => ({ ...prev, durationSec: prev.durationSec + 1 }));
        }, 1000);

        // Auto-save transcript every 30 seconds
        autoSaveRef.current = setInterval(() => {
          setState((prev) => {
            if (prev.transcript.length > lastSavedLengthRef.current) {
              lastSavedLengthRef.current = prev.transcript.length;
              saveTranscript(prev.transcript, prev.durationSec);
            }
            return prev;
          });
        }, 30000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = (evt) => {
        addLog(`WebSocket error event: ${JSON.stringify(evt)}`);
        setState((prev) => ({ ...prev, status: "error", error: "WebSocket connection failed" }));
      };

      ws.onclose = (evt) => {
        addLog(`WebSocket closed: code=${evt.code} reason="${evt.reason}" clean=${evt.wasClean}`);
        setState((prev) => {
          if (prev.transcript.length > 0) {
            saveTranscript(prev.transcript, prev.durationSec);
          }
          if (prev.status === "active") {
            return { ...prev, status: "ended" };
          }
          return prev;
        });
        cleanup();
      };
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start interview",
      }));
    }
  }, [deepgramApiKey, anthropicApiKey, siteName, customerName, existingData, siteId, assessmentId, tenantId, handleMessage, previousInterviews, resumeSection, saveTranscript, addLog]);

  // ─── Input Mode ────────────────────────────────────

  const handleInputModeChange = useCallback((mode: InputMode) => {
    setState((prev) => ({ ...prev, inputMode: mode }));
    isMicMutedRef.current = mode === "text";
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "InjectUserMessage", message: text }));
    }
  }, []);

  // ─── Latest agent text for live caption ──────────────
  // Show live buffered text while agent speaks, or last transcript entry when done
  const [liveCaption, setLiveCaption] = useState("");

  // Update live caption from pending buffer
  useEffect(() => {
    if (state.agentState === "speaking" && pendingAgentTextRef.current.length > 0) {
      const interval = setInterval(() => {
        if (pendingAgentTextRef.current.length > 0) {
          const seen = new Set<string>();
          const unique = pendingAgentTextRef.current.filter((t) => {
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
          });
          setLiveCaption(unique.join(" "));
        }
      }, 200);
      return () => clearInterval(interval);
    } else if (state.agentState !== "speaking") {
      // When agent stops, show the last transcript entry briefly
      const last = state.transcript[state.transcript.length - 1];
      if (last?.role === "agent") setLiveCaption(last.text);
    }
  }, [state.agentState, state.transcript]);

  const latestAgentText = liveCaption;

  // ─── Cleanup ───────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    if (micLevelFrameRef.current) cancelAnimationFrame(micLevelFrameRef.current);
    if (analyserRef.current) analyserRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close().catch(() => {});
  }, []);

  const endInterview = useCallback(async () => {
    if (interviewIdRef.current) {
      await fetch("/api/interview/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionName: "_end_interview",
          args: {
            transcript: state.transcript,
            fieldsCollected: {},
            durationSec: state.durationSec,
          },
          siteId, assessmentId, tenantId,
          interviewId: interviewIdRef.current,
        }),
      });
      // Analysis is auto-triggered by _end_interview
      setAnalysisStatus("processing");
    }

    wsRef.current?.close();
    cleanup();
    setState((prev) => ({ ...prev, status: "ended" }));
  }, [state.transcript, state.durationSec, siteId, assessmentId, tenantId, cleanup]);

  // ─── Poll for analysis completion ─────────────────────

  const analysisPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (analysisStatus === "processing" && interviewIdRef.current) {
      analysisPollerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/interview/save-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              functionName: "_save_transcript",
              args: { transcript: [], fieldsCollected: {}, durationSec: 0 },
              siteId, assessmentId, tenantId,
              interviewId: "CHECK_STATUS", // Dummy — we just need the endpoint
            }),
          });
          // Instead, let's check via a simple query approach
          // For now, just wait a reasonable time and mark as completed
        } catch {
          // ignore
        }
      }, 5000);

      // Assume analysis completes within ~30 seconds
      const timeout = setTimeout(() => {
        setAnalysisStatus("completed");
        if (analysisPollerRef.current) clearInterval(analysisPollerRef.current);
      }, 30000);

      return () => {
        if (analysisPollerRef.current) clearInterval(analysisPollerRef.current);
        clearTimeout(timeout);
      };
    }
  }, [analysisStatus, siteId, assessmentId, tenantId]);

  // Keep a ref to current state for beforeunload handler
  const stateRef = useRef(state);
  stateRef.current = state;

  // Save transcript on tab close / navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = stateRef.current;
      if (interviewIdRef.current && s.transcript.length > 0 && s.status === "active") {
        navigator.sendBeacon(
          "/api/interview/save-answer",
          new Blob([JSON.stringify({
            functionName: "_save_transcript",
            args: { transcript: s.transcript, fieldsCollected: {}, durationSec: s.durationSec },
            siteId, assessmentId, tenantId,
            interviewId: interviewIdRef.current,
          })], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      wsRef.current?.close();
      cleanup();
    };
  }, [cleanup, siteId, assessmentId, tenantId]);

  // ─── Format Timer ──────────────────────────────────────

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ─── Render ────────────────────────────────────────────

  if (state.status === "ready") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
            <Mic className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ATLAS Interview Agent</h1>
          <p className="text-gray-500 max-w-md">
            Start a voice interview to collect baseline data for <strong>{siteName}</strong>.
            The AI agent will guide the conversation through equipment, energy, operations, and staffing.
          </p>
          <p className="text-sm text-gray-400">
            ~20-30 minutes · Transcript analyzed after conversation
          </p>
          {previousInterviews && previousInterviews.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 max-w-md mx-auto">
              <p className="text-sm text-blue-700">
                This site has {previousInterviews.length} previous interview{previousInterviews.length > 1 ? "s" : ""}.
                The agent will offer a recap and focus on new topics.
              </p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={startInterview} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
          <Mic className="h-5 w-5 mr-2" />
          Start Interview
        </Button>
        <button
          onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}`)}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {siteName}
        </button>
      </div>
    );
  }

  if (state.status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
        <p className="text-gray-500">Connecting to ATLAS Interview Agent...</p>
        <p className="text-xs text-gray-400">Setting up microphone and AI voice...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <MicOff className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Connection Error</h2>
        <p className="text-red-600 text-sm max-w-md text-center">{state.error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, status: "ready", error: undefined }))}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}`)}>
            Back to Site
          </Button>
        </div>
        {debugLogs.length > 0 && (
          <div className="w-full max-w-lg mt-4">
            <button onClick={() => setShowDebug(!showDebug)} className="text-xs text-gray-400 hover:text-gray-600">
              {showDebug ? "Hide" : "Show"} debug log ({debugLogs.length} entries)
            </button>
            {showDebug && (
              <div className="mt-2 bg-gray-900 text-green-400 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Interview Complete</h2>
        <div className="text-center text-gray-500 space-y-1">
          <p>Duration: {formatTime(state.durationSec)}</p>
          <p>{state.transcript.length} conversation turns captured</p>
        </div>

        {/* Analysis status */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-w-md w-full">
          <div className="flex items-center gap-3">
            {analysisStatus === "processing" && (
              <>
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Analyzing transcript...</p>
                  <p className="text-xs text-gray-500">Extracting baseline data from your conversation</p>
                </div>
              </>
            )}
            {analysisStatus === "completed" && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Analysis complete</p>
                  <p className="text-xs text-gray-500">Baseline data has been extracted and saved</p>
                </div>
              </>
            )}
            {analysisStatus === "failed" && (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Analysis failed</p>
                  <p className="text-xs text-gray-500">You can retry from the baseline tab</p>
                </div>
              </>
            )}
            {analysisStatus === "idle" && (
              <>
                <BarChart3 className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Ready to analyze</p>
                  <p className="text-xs text-gray-500">Transcript saved — analysis will extract baseline data</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}?tab=baseline`)}>
            View Baseline Data
          </Button>
          <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, status: "ready", transcript: [], durationSec: 0 }))}>
            Start New Interview
          </Button>
        </div>
      </div>
    );
  }

  // Active interview
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <button
          onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}`)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> {siteName}
        </button>
        <div className="flex items-center gap-4">
          <InterviewControls
            status={state.status}
            agentState={state.agentState}
            micLevel={micLevel}
            onEnd={endInterview}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Call View + Input */}
        <div className="flex-1 flex flex-col min-w-0">
          <InterviewCallView
            agentState={state.agentState}
            micLevel={micLevel}
            latestAgentText={latestAgentText}
            durationSec={state.durationSec}
          />
          <InterviewInputPanel
            inputMode={state.inputMode}
            micLevel={micLevel}
            onModeChange={handleInputModeChange}
            onSendMessage={handleSendMessage}
          />
        </div>

        {/* Right: Transcript Panel */}
        <InterviewDataPanel
          transcript={state.transcript}
          durationSec={state.durationSec}
        />
      </div>

      {/* Debug log toggle */}
      <div className="border-t border-gray-100 bg-gray-50 px-3 py-1 flex items-center justify-between">
        <button onClick={() => setShowDebug(!showDebug)} className="text-[10px] text-gray-400 hover:text-gray-600">
          {showDebug ? "Hide" : "Show"} debug log ({debugLogs.length})
        </button>
        <span className="text-[10px] text-gray-300">
          WS: {wsRef.current?.readyState === WebSocket.OPEN ? "connected" : wsRef.current?.readyState === WebSocket.CONNECTING ? "connecting" : "disconnected"}
        </span>
      </div>
      {showDebug && (
        <div className="bg-gray-900 text-green-400 px-3 py-2 max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}
    </div>
  );
}
