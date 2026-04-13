"use client";

import { useState, useCallback, useRef } from "react";

export type TestPhase =
  | "idle"
  | "running_latency"
  | "running_download"
  | "running_upload"
  | "complete"
  | "error";

export interface TestResults {
  download_mbps: number | null;
  upload_mbps: number | null;
  latency_ms: number | null;
  jitter_ms: number | null;
}

const PING_COUNT = 12;
const PING_WARMUP = 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function stdDev(values: number[]): number {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function useNetworkTest() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [results, setResults] = useState<TestResults>({
    download_mbps: null,
    upload_mbps: null,
    latency_ms: null,
    jitter_ms: null,
  });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runTest = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setError(null);
    setResults({ download_mbps: null, upload_mbps: null, latency_ms: null, jitter_ms: null });

    try {
      // ── Phase 1: Latency & Jitter ──
      setPhase("running_latency");
      const rtts: number[] = [];
      for (let i = 0; i < PING_COUNT; i++) {
        if (abort.signal.aborted) return;
        const t0 = performance.now();
        await fetch(`/api/network-test/ping?_=${Date.now()}_${i}`, {
          signal: abort.signal,
          cache: "no-store",
        });
        const rtt = performance.now() - t0;
        if (i >= PING_WARMUP) {
          rtts.push(rtt);
        }
      }
      const latency = Math.round(median(rtts) * 10) / 10;
      const jitter = Math.round(stdDev(rtts) * 10) / 10;
      setResults((r) => ({ ...r, latency_ms: latency, jitter_ms: jitter }));

      // ── Phase 2: Download ──
      setPhase("running_download");
      let dlBytes = 0;
      let dlTime = 0;
      let dlSize = 256 * 1024; // Start at 256KB
      for (let round = 0; round < 5; round++) {
        if (abort.signal.aborted) return;
        const t0 = performance.now();
        const resp = await fetch(
          `/api/network-test/download?size=${dlSize}&_=${Date.now()}_${round}`,
          { signal: abort.signal, cache: "no-store" },
        );
        const buf = await resp.arrayBuffer();
        const elapsed = (performance.now() - t0) / 1000;
        dlBytes += buf.byteLength;
        dlTime += elapsed;
        // Adaptive: double size if finished quickly
        if (elapsed < 1) {
          dlSize = Math.min(dlSize * 2, 4 * 1024 * 1024);
        }
        // Stop if we've spent >8 seconds total
        if (dlTime > 8) break;
      }
      const downloadMbps =
        dlTime > 0 ? Math.round(((dlBytes * 8) / (dlTime * 1_000_000)) * 100) / 100 : null;
      setResults((r) => ({ ...r, download_mbps: downloadMbps }));

      // ── Phase 3: Upload ──
      setPhase("running_upload");
      let ulBytes = 0;
      let ulTime = 0;
      let ulSize = 128 * 1024; // Start at 128KB
      for (let round = 0; round < 5; round++) {
        if (abort.signal.aborted) return;
        const payload = new Uint8Array(ulSize);
        crypto.getRandomValues(payload);
        const t0 = performance.now();
        await fetch(`/api/network-test/upload?_=${Date.now()}_${round}`, {
          method: "POST",
          body: payload,
          signal: abort.signal,
          cache: "no-store",
        });
        const elapsed = (performance.now() - t0) / 1000;
        ulBytes += ulSize;
        ulTime += elapsed;
        if (elapsed < 1) {
          ulSize = Math.min(ulSize * 2, 2 * 1024 * 1024);
        }
        if (ulTime > 8) break;
      }
      const uploadMbps =
        ulTime > 0 ? Math.round(((ulBytes * 8) / (ulTime * 1_000_000)) * 100) / 100 : null;
      setResults((r) => ({ ...r, upload_mbps: uploadMbps }));

      setPhase("complete");
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Test failed");
      setPhase("error");
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
  }, []);

  return { phase, results, error, runTest, cancel };
}
