"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildAgentSettings } from "../../../../../../../../lib/interview/agent-config";
import type { InterviewState, TranscriptEntry, CollectedField, InterviewSection } from "../../../../../../../../lib/interview/interview-types";
import { INTERVIEW_SECTIONS } from "../../../../../../../../lib/interview/interview-types";
import { InterviewTranscript } from "./interview-transcript";
import { InterviewSidebar } from "./interview-sidebar";
import { InterviewControls } from "./interview-controls";
import {
  Mic, MicOff, ArrowLeft, Loader2,
} from "lucide-react";
import { Button } from "../../../../../../../../components/ui/button";

interface Props {
  siteId: string;
  siteName: string;
  siteSlug: string;
  customerName: string;
  customerSlug: string;
  tenantId: string;
  assessmentId: string;
  existingData?: Record<string, unknown>;
  deepgramApiKey: string;
  anthropicApiKey?: string;
}

export function InterviewSession({
  siteId, siteName, siteSlug, customerName, customerSlug,
  tenantId, assessmentId, existingData, deepgramApiKey, anthropicApiKey,
}: Props) {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micLevelFrameRef = useRef<number>(0);
  const playbackQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interviewIdRef = useRef<string | null>(null);

  const [micLevel, setMicLevel] = useState(0);

  const [state, setState] = useState<InterviewState>({
    status: "ready",
    agentState: "idle",
    currentSection: "welcome",
    transcript: [],
    collectedFields: {},
    progress: 0,
    durationSec: 0,
  });

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

    // Schedule gaplessly — each chunk starts exactly when the previous ends
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const processPlaybackQueue = useCallback(() => {
    // Process all queued chunks immediately — scheduling handles timing
    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      playAudioChunk(chunk);
    }
  }, [playAudioChunk]);

  // ─── Function Call Handler ─────────────────────────────

  const handleFunctionCall = useCallback(async (
    functionName: string,
    functionArgs: Record<string, unknown>,
    callId: string,
  ) => {
    try {
      // Save to database via API
      const res = await fetch("/api/interview/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionName,
          args: functionArgs,
          siteId,
          assessmentId,
          tenantId,
          interviewId: interviewIdRef.current ?? "",
        }),
      });

      const result = await res.json();

      // Update local collected fields
      if (result.success) {
        setState((prev) => {
          const section = functionName === "advance_section"
            ? (functionArgs.next_section as InterviewSection)
            : prev.currentSection;

          const newFields = { ...prev.collectedFields };
          if (functionName !== "advance_section" && result.fieldsSaved) {
            const sectionKey = functionName.replace("save_", "");
            const existing = newFields[sectionKey] ?? [];
            newFields[sectionKey] = [
              ...existing,
              ...((result.fieldsSaved as CollectedField[]) ?? []),
            ];
          }

          // Calculate progress
          const totalFields = Object.values(newFields).reduce((sum, arr) => sum + arr.length, 0);
          const progress = Math.min(100, Math.round((totalFields / 30) * 100)); // ~30 key fields

          return {
            ...prev,
            currentSection: functionName === "advance_section" ? section : prev.currentSection,
            collectedFields: newFields,
            progress,
          };
        });
      }

      // Send function response back to agent
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "FunctionCallResponse",
          function_call_id: callId,
          output: JSON.stringify(result.success ? { status: "saved", ...result } : { status: "error", error: result.error }),
        }));
      }
    } catch (err) {
      // Send error response
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "FunctionCallResponse",
          function_call_id: callId,
          output: JSON.stringify({ status: "error", error: String(err) }),
        }));
      }
    }
  }, [siteId, assessmentId, tenantId]);

  // ─── WebSocket Message Handler ─────────────────────────

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      // Binary audio from agent
      const pcm = new Int16Array(event.data);
      playbackQueueRef.current.push(pcm);
      processPlaybackQueue();
      return;
    }

    try {
      const msg = JSON.parse(event.data as string);

      switch (msg.type) {
        case "Welcome":
          // Connection established, send settings
          break;

        case "SettingsApplied":
          setState((prev) => ({ ...prev, status: "active", agentState: "idle" }));
          break;

        case "ConversationText": {
          const role = msg.role === "assistant" ? "agent" : "user";
          const text = msg.content ?? "";
          if (!text) break;
          setState((prev) => {
            // Deduplicate: skip if last entry has same role and text
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
          break;
        }

        case "AgentThinking":
          setState((prev) => ({ ...prev, agentState: "thinking" }));
          break;

        case "AgentStartedSpeaking":
          setState((prev) => ({ ...prev, agentState: "speaking" }));
          break;

        case "AgentAudioDone":
          setState((prev) => ({ ...prev, agentState: "listening" }));
          break;

        case "UserStartedSpeaking":
          // Stop agent audio playback (barge-in)
          playbackQueueRef.current = [];
          setState((prev) => ({ ...prev, agentState: "listening" }));
          break;

        case "FunctionCallRequest":
          handleFunctionCall(
            msg.function_name,
            typeof msg.input === "string" ? JSON.parse(msg.input) : msg.input,
            msg.function_call_id,
          );
          break;

        case "Error":
        case "Warning":
          console.error("Deepgram error:", JSON.stringify(msg));
          setState((prev) => ({
            ...prev,
            status: "error",
            error: msg.message ?? msg.description ?? msg.error ?? JSON.stringify(msg),
          }));
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, [handleFunctionCall, processPlaybackQueue]);

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
          siteId,
          assessmentId,
          tenantId,
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

      // Connect WebSocket
      const ws = new WebSocket(
        "wss://agent.deepgram.com/v1/agent/converse",
        ["token", deepgramApiKey]
      );
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        // Send settings
        const settings = buildAgentSettings({
          siteName,
          customerName,
          existingData,
          anthropicApiKey,
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
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]!));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
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

        // Start keep-alive
        keepAliveRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 7000);

        // Start timer
        timerRef.current = setInterval(() => {
          setState((prev) => ({ ...prev, durationSec: prev.durationSec + 1 }));
        }, 1000);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setState((prev) => ({ ...prev, status: "error", error: "WebSocket connection failed" }));
      };

      ws.onclose = () => {
        if (state.status === "active") {
          setState((prev) => ({ ...prev, status: "ended" }));
        }
        cleanup();
      };
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Failed to start interview",
      }));
    }
  }, [deepgramApiKey, anthropicApiKey, siteName, customerName, existingData, siteId, assessmentId, tenantId, handleMessage, state.status]);

  // ─── Cleanup ───────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (micLevelFrameRef.current) cancelAnimationFrame(micLevelFrameRef.current);
    if (analyserRef.current) analyserRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close().catch(() => {});
  }, []);

  const endInterview = useCallback(async () => {
    // Save final state
    if (interviewIdRef.current) {
      await fetch("/api/interview/save-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          functionName: "_end_interview",
          args: {
            transcript: state.transcript,
            fieldsCollected: state.collectedFields,
            durationSec: state.durationSec,
          },
          siteId,
          assessmentId,
          tenantId,
          interviewId: interviewIdRef.current,
        }),
      });
    }

    wsRef.current?.close();
    cleanup();
    setState((prev) => ({ ...prev, status: "ended" }));
  }, [state.transcript, state.collectedFields, state.durationSec, siteId, assessmentId, tenantId, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      cleanup();
    };
  }, [cleanup]);

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
            ~20-30 minutes · Real-time data extraction · Voice or text input
          </p>
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
        <p className="text-red-600 text-sm">{state.error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setState((prev) => ({ ...prev, status: "ready", error: undefined }))}>
            Try Again
          </Button>
          <Button variant="outline" onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}`)}>
            Back to Site
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === "ended") {
    const totalFields = Object.values(state.collectedFields).reduce((sum, arr) => sum + arr.length, 0);
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Interview Complete</h2>
        <div className="text-center text-gray-500 space-y-1">
          <p>Duration: {formatTime(state.durationSec)}</p>
          <p>{totalFields} data points collected</p>
          <p>{state.transcript.length} conversation turns</p>
        </div>
        <Button onClick={() => router.push(`/customers/${customerSlug}/sites/${siteSlug}?tab=baseline`)}>
          View Baseline Data →
        </Button>
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
          <span className="text-sm font-mono text-gray-500">⏱ {formatTime(state.durationSec)}</span>
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
        {/* Transcript */}
        <div className="flex-1 flex flex-col">
          <InterviewTranscript
            transcript={state.transcript}
            agentState={state.agentState}
          />

          {/* Text input fallback */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input") as HTMLInputElement;
                const text = input.value.trim();
                if (!text || !wsRef.current) return;
                wsRef.current.send(JSON.stringify({ type: "InjectUserMessage", message: text }));
                input.value = "";
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Type a message... (or just speak)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
              <Button type="submit" size="sm" variant="outline">Send</Button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <InterviewSidebar
          currentSection={state.currentSection}
          collectedFields={state.collectedFields}
          progress={state.progress}
          onSendNote={(text) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "InjectUserMessage", message: text }));
            }
          }}
        />
      </div>
    </div>
  );
}
