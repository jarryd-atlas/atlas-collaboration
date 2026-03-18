"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Pause, Play, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  className?: string;
}

type RecordingState = "idle" | "recording" | "paused" | "error";

const BAR_COUNT = 32;

export function VoiceRecorder({ onRecordingComplete, className }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amplitudes, setAmplitudes] = useState<number[]>(new Array(BAR_COUNT).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopVisualization();
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startVisualization = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      // Sample evenly across the frequency range
      const step = Math.floor(dataArray.length / BAR_COUNT);
      const bars: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = dataArray[i * step] ?? 0;
        bars.push(value / 255); // normalize 0-1
      }
      setAmplitudes(bars);
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  const stopVisualization = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAmplitudes(new Array(BAR_COUNT).fill(0));
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      setElapsed(pausedElapsedRef.current + Math.floor((now - startTimeRef.current) / 1000));
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    chunksRef.current = [];
    setElapsed(0);
    pausedElapsedRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio API for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const totalElapsed = pausedElapsedRef.current +
          Math.floor((Date.now() - startTimeRef.current) / 1000);
        onRecordingComplete(blob, totalElapsed);

        // Clean up stream
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        audioContext.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect data every 250ms
      setState("recording");
      startTimer();
      startVisualization();
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access in your browser settings."
          : "Could not access microphone. Please check your audio settings.";
      setErrorMessage(message);
      setState("error");
    }
  }, [onRecordingComplete, startTimer, startVisualization]);

  const stopRecording = useCallback(() => {
    stopTimer();
    stopVisualization();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setState("idle");
  }, [stopTimer, stopVisualization]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pausedElapsedRef.current = elapsed;
      stopTimer();
      stopVisualization();
      setState("paused");
    }
  }, [elapsed, stopTimer, stopVisualization]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimer();
      startVisualization();
      setState("recording");
    }
  }, [startTimer, startVisualization]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-100 bg-white p-6 shadow-card",
        className,
      )}
    >
      {/* Waveform visualization */}
      <div className="flex items-end justify-center gap-[3px] h-16 mb-6">
        {amplitudes.map((amp, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-full transition-all duration-75",
              state === "recording"
                ? "bg-brand-green"
                : state === "paused"
                  ? "bg-gray-300"
                  : "bg-gray-200",
            )}
            style={{
              height: `${Math.max(4, amp * 64)}px`,
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <div className="text-center mb-6">
        <p className="text-3xl font-bold text-gray-900 font-mono tabular-nums">
          {formatTime(elapsed)}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {state === "idle" && "Ready to record"}
          {state === "recording" && "Recording..."}
          {state === "paused" && "Paused"}
          {state === "error" && "Error"}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === "idle" || state === "error" ? (
          <Button onClick={startRecording} variant="primary" size="lg" className="gap-2">
            <Mic className="h-5 w-5" />
            Start Recording
          </Button>
        ) : (
          <>
            {state === "recording" ? (
              <Button onClick={pauseRecording} variant="outline" size="icon">
                <Pause className="h-5 w-5" />
              </Button>
            ) : (
              <Button onClick={resumeRecording} variant="outline" size="icon">
                <Play className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={stopRecording} variant="danger" size="lg" className="gap-2">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          </>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
