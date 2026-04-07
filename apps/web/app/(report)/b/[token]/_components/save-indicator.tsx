"use client";

import { useEffect, useState } from "react";
import type { SaveStatus } from "../../../../../lib/baseline-form/types";

interface SaveIndicatorProps {
  status: SaveStatus;
  onRetry?: () => void;
}

export function SaveIndicator({ status, onRetry }: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      setFadeOut(false);
      return;
    }

    setVisible(true);
    setFadeOut(false);

    // Auto-hide "saved" after 2 seconds
    if (status === "saved") {
      const fadeTimer = setTimeout(() => setFadeOut(true), 1500);
      const hideTimer = setTimeout(() => setVisible(false), 2000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [status]);

  // Offline banner at top
  if (status === "offline") {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
        <p className="text-sm text-amber-800 inline-flex items-center gap-2">
          <svg
            className="h-4 w-4 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          Connection lost -- retrying...
        </p>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-opacity duration-300 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 shadow-sm px-3 py-2 text-sm">
        {status === "saving" && (
          <>
            <svg
              className="animate-spin h-4 w-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-gray-500">Saving...</span>
          </>
        )}

        {status === "saved" && (
          <>
            <svg
              className="h-4 w-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            <span className="text-green-600">Saved</span>
          </>
        )}

        {status === "error" && (
          <>
            <svg
              className="h-4 w-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span className="text-red-600">Error saving</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-red-600 underline underline-offset-2 hover:text-red-700 text-xs font-medium ml-1"
              >
                Retry
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
