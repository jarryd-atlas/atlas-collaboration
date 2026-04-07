"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { SaveStatus } from "../baseline-form/types";

interface UseAutoSaveOptions {
  /** Debounce delay in ms (default 800) */
  debounceMs?: number;
  /** How long to show "Saved" before returning to idle (default 2000) */
  savedDisplayMs?: number;
}

/**
 * Hook for debounced auto-saving with status tracking and retry.
 *
 * Usage:
 *   const { save, status, flush } = useAutoSave(async (value) => {
 *     await serverAction(value);
 *   });
 *
 *   // Call save() on every change — it debounces automatically
 *   save(newValue);
 *
 *   // Call flush() before navigating away to force-save pending changes
 *   flush();
 */
export function useAutoSave<T>(
  saveFn: (value: T) => Promise<{ error?: string } | void>,
  options: UseAutoSaveOptions = {}
) {
  const { debounceMs = 800, savedDisplayMs = 2000 } = options;

  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | null>(null);
  const isSavingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Clean up timers
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const executeSave = useCallback(
    async (value: T) => {
      if (isSavingRef.current) {
        // Queue for later
        pendingValueRef.current = value;
        return;
      }

      isSavingRef.current = true;
      setStatus("saving");

      try {
        const result = await saveFn(value);
        if (result && "error" in result && result.error) {
          throw new Error(result.error);
        }

        retryCountRef.current = 0;
        setStatus("saved");

        // Clear "saved" after delay
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => {
          setStatus("idle");
        }, savedDisplayMs);
      } catch (err) {
        retryCountRef.current++;

        if (retryCountRef.current < maxRetries) {
          // Retry with exponential backoff
          setStatus("saving");
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 8000);
          timeoutRef.current = setTimeout(() => {
            executeSave(value);
          }, delay);
        } else {
          setStatus("error");
          retryCountRef.current = 0;
        }
      } finally {
        isSavingRef.current = false;

        // Process queued value
        if (pendingValueRef.current !== null) {
          const queued = pendingValueRef.current;
          pendingValueRef.current = null;
          executeSave(queued);
        }
      }
    },
    [saveFn, savedDisplayMs]
  );

  /** Debounced save — call this on every change */
  const save = useCallback(
    (value: T) => {
      pendingValueRef.current = value;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const val = pendingValueRef.current;
        if (val !== null) {
          pendingValueRef.current = null;
          executeSave(val);
        }
      }, debounceMs);
    },
    [debounceMs, executeSave]
  );

  /** Force-save any pending changes immediately (e.g., before section navigation) */
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const val = pendingValueRef.current;
    if (val !== null) {
      pendingValueRef.current = null;
      await executeSave(val);
    }
  }, [executeSave]);

  /** Reset status to idle (e.g., after dismissing error) */
  const reset = useCallback(() => {
    setStatus("idle");
    retryCountRef.current = 0;
  }, []);

  return { save, flush, status, reset };
}
