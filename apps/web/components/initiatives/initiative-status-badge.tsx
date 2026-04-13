"use client";

import { cn } from "../../lib/utils";

type InitiativeStatus = "active" | "on_hold" | "waiting" | "completed" | "cancelled";

const STATUS_CONFIG: Record<InitiativeStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-blue-50 text-blue-700 ring-blue-200" },
  on_hold: { label: "On Hold", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  waiting: { label: "Waiting", className: "bg-purple-50 text-purple-700 ring-purple-200" },
  completed: { label: "Completed", className: "bg-green-50 text-green-700 ring-green-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-50 text-gray-500 ring-gray-200" },
};

interface InitiativeStatusBadgeProps {
  status: string;
  className?: string;
}

export function InitiativeStatusBadge({ status, className }: InitiativeStatusBadgeProps) {
  const config = STATUS_CONFIG[status as InitiativeStatus] ?? STATUS_CONFIG.active;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export const INITIATIVE_STATUSES: { value: InitiativeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
