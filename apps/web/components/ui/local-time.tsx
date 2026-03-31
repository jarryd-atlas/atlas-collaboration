"use client";

import { useEffect, useState } from "react";

interface LocalTimeProps {
  dateStr: string;
  format?: "time" | "day" | "day-label";
  className?: string;
}

/**
 * Renders a date/time string in the user's local timezone.
 * Server-side renders a placeholder, then hydrates with local time.
 */
export function LocalTime({ dateStr, format = "time", className }: LocalTimeProps) {
  const [display, setDisplay] = useState(() => formatFallback(dateStr, format));

  useEffect(() => {
    setDisplay(formatLocal(dateStr, format));
  }, [dateStr, format]);

  return <span className={className}>{display}</span>;
}

function formatLocal(dateStr: string, format: string): string {
  const d = new Date(dateStr);

  if (format === "time") {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (format === "day-label") {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  if (format === "day") {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return d.toLocaleDateString(undefined, {
      weekday: "short",
    });
  }

  return d.toLocaleString();
}

/** Fallback for SSR — shows a compact UTC-based time */
function formatFallback(dateStr: string, format: string): string {
  const d = new Date(dateStr);
  if (format === "time") {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }
  if (format === "day-label" || format === "day") {
    return d.toISOString().split("T")[0] ?? "";
  }
  return dateStr;
}
