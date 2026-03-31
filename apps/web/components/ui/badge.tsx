import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-50 text-green-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
  outline: "border border-gray-200 text-gray-600 bg-white",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Specialized badges ────────────────────────────────────

const statusVariants: Record<string, BadgeVariant> = {
  // Pipeline stages
  whitespace: "outline",
  prospect: "default",
  evaluation: "info",
  qualified: "info",
  disqualified: "error",
  contracted: "warning",
  deployment: "warning",
  active: "success",
  paused: "default",
  // Milestone statuses
  not_started: "default",
  in_progress: "info",
  completed: "success",
  on_hold: "warning",
  // Task statuses
  todo: "default",
  in_review: "warning",
  done: "success",
  // Issue statuses
  open: "error",
  acknowledged: "warning",
  resolved: "success",
};

const priorityVariants: Record<string, BadgeVariant> = {
  low: "default",
  medium: "info",
  high: "warning",
  urgent: "error",
};

const severityVariants: Record<string, BadgeVariant> = {
  low: "default",
  medium: "warning",
  high: "error",
  critical: "error",
};

function formatLabel(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusVariants[status] ?? "default"} className={className}>
      {formatLabel(status)}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <Badge variant={priorityVariants[priority] ?? "default"} className={className}>
      {formatLabel(priority)}
    </Badge>
  );
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <Badge variant={severityVariants[severity] ?? "default"} className={className}>
      {formatLabel(severity)}
    </Badge>
  );
}

/** Company type badge (internal view only) */
export function CompanyTypeBadge({ type, className }: { type: string; className?: string }) {
  const variant: BadgeVariant = type === "prospect" ? "warning" : "success";
  return (
    <Badge variant={variant} className={className}>
      {formatLabel(type)}
    </Badge>
  );
}

/** Account stage badge (Pilot / Expanding / Enterprise) */
export function AccountStageBadge({ stage, className }: { stage: string; className?: string }) {
  const stageVariants: Record<string, BadgeVariant> = {
    pilot: "default",
    expanding: "info",
    enterprise: "success",
  };
  const stageColors: Record<string, string> = {
    pilot: "",
    expanding: "",
    enterprise: "bg-purple-50 text-purple-700",
  };
  return (
    <Badge
      variant={stageVariants[stage] ?? "default"}
      className={cn(stageColors[stage], className)}
    >
      {formatLabel(stage)}
    </Badge>
  );
}

/** Deal stage badge */
export function DealStageBadge({ stage, className }: { stage: string; className?: string }) {
  const dealColors: Record<string, string> = {
    identified: "bg-blue-50 text-blue-700",
    proposal: "bg-amber-50 text-amber-700",
    negotiation: "bg-purple-50 text-purple-700",
    closed_won: "bg-green-50 text-green-700",
    closed_lost: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        dealColors[stage] ?? "bg-gray-100 text-gray-600",
        className,
      )}
    >
      {formatLabel(stage)}
    </span>
  );
}

/** Pipeline stage badge with colored dot */
export function PipelineStageBadge({ stage, className }: { stage: string; className?: string }) {
  const dotColors: Record<string, string> = {
    whitespace: "bg-stage-whitespace",
    prospect: "bg-stage-prospect",
    evaluation: "bg-stage-evaluation",
    qualified: "bg-stage-qualified",
    disqualified: "bg-stage-disqualified",
    contracted: "bg-stage-contracted",
    deployment: "bg-stage-deployment",
    active: "bg-stage-active",
    paused: "bg-stage-paused",
  };

  return (
    <Badge variant="outline" className={className}>
      <span className={cn("mr-1.5 h-2 w-2 rounded-full", dotColors[stage] ?? "bg-gray-400")} />
      {formatLabel(stage)}
    </Badge>
  );
}
