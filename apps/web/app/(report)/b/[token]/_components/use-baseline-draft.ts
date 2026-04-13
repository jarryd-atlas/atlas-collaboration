"use client";

import { useEffect, useRef, useCallback } from "react";
import type { BaselineFormState, BaselineFormAction } from "../../../../../lib/baseline-form/types";

const DRAFT_VERSION = 1;

interface DraftEnvelope {
  version: number;
  updatedAt: number;
  data: Omit<BaselineFormState, "meta">;
}

/**
 * Persist form state to localStorage as a draft backup.
 * - Debounced write (500ms) on every state change
 * - On mount: if draft is newer than server data, restore it
 * - clearDraft() should be called after every successful server save
 */
export function useBaselineDraft(
  token: string,
  state: BaselineFormState,
  dispatch: React.Dispatch<BaselineFormAction>,
  serverLastSavedAt: string | null,
) {
  const STORAGE_KEY = `atlas-baseline-draft:${token}`;
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  // ── Restore draft on mount (once) ─────────────────────────
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const envelope: DraftEnvelope = JSON.parse(raw);
      if (envelope.version !== DRAFT_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      // Only restore if draft is newer than server data
      const serverTime = serverLastSavedAt
        ? new Date(serverLastSavedAt).getTime()
        : 0;

      if (envelope.updatedAt > serverTime) {
        dispatch({ type: "HYDRATE", state: envelope.data });
      } else {
        // Draft is older than server — discard
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Corrupted draft — remove it
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced write on state change ───────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current);
    }

    writeTimerRef.current = setTimeout(() => {
      try {
        const { meta: _meta, ...data } = state;
        const envelope: DraftEnvelope = {
          version: DRAFT_VERSION,
          updatedAt: Date.now(),
          data,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // QuotaExceededError or other — degrade gracefully
      }
    }, 500);

    return () => {
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current);
      }
    };
  }, [state, STORAGE_KEY]);

  // ── Clear draft after server save ─────────────────────────
  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [STORAGE_KEY]);

  return { clearDraft };
}
