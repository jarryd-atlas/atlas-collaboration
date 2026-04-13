"use client";

import { cn } from "../../lib/utils";

export type RockStatus = "on_track" | "off_track" | "complete" | "incomplete";

const STATUS_CONFIG: Record<RockStatus, { label: string; className: string }> = {
  on_track: { label: "On Track", className: "bg-green-50 text-green-700 ring-green-200" },
  off_track: { label: "Off Track", className: "bg-red-50 text-red-700 ring-red-200" },
  complete: { label: "Complete", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  incomplete: { label: "Incomplete", className: "bg-gray-50 text-gray-500 ring-gray-200" },
};

export const ROCK_STATUSES: { value: RockStatus; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "off_track", label: "Off Track" },
  { value: "complete", label: "Complete" },
  { value: "incomplete", label: "Incomplete" },
];

interface RockStatusBadgeProps {
  status: string;
  className?: string;
}

export function RockStatusBadge({ status, className }: RockStatusBadgeProps) {
  const config = STATUS_CONFIG[status as RockStatus] ?? STATUS_CONFIG.on_track;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
