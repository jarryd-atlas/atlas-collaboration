"use client";

import { useEffect, useState } from "react";

export interface SaveToastData {
  message: string;
  type: "success" | "warning" | "info";
  action?: { label: string; onClick: () => void };
}

interface SaveToastProps {
  toast: SaveToastData | null;
  onDismiss: () => void;
}

export function SaveToast({ toast, onDismiss }: SaveToastProps) {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      setFadeOut(false);
      return;
    }

    setVisible(true);
    setFadeOut(false);

    // Auto-dismiss success/info toasts after 3s
    if (toast.type === "success" || toast.type === "info") {
      const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 3000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [toast, onDismiss]);

  if (!visible || !toast) return null;

  const borderColor =
    toast.type === "success"
      ? "border-l-green-500"
      : toast.type === "warning"
        ? "border-l-amber-500"
        : "border-l-blue-500";

  const iconColor =
    toast.type === "success"
      ? "text-green-500"
      : toast.type === "warning"
        ? "text-amber-500"
        : "text-blue-500";

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ${
        fadeOut ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <div
        className={`flex items-center gap-3 rounded-lg border border-gray-200 border-l-4 ${borderColor} bg-white px-4 py-3 shadow-lg`}
      >
        {/* Icon */}
        {toast.type === "success" && (
          <svg
            className={`h-5 w-5 shrink-0 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        {toast.type === "warning" && (
          <svg
            className={`h-5 w-5 shrink-0 ${iconColor}`}
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
        )}
        {toast.type === "info" && (
          <svg
            className={`h-5 w-5 shrink-0 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
        )}

        <span className="text-sm font-medium text-gray-800">
          {toast.message}
        </span>

        {/* CTA button */}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="ml-2 rounded-md bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            {toast.action.label}
          </button>
        )}

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => {
            setFadeOut(true);
            setTimeout(() => {
              setVisible(false);
              onDismiss();
            }, 300);
          }}
          className="ml-1 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
