import { cn } from "../../lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ProgressBar({ value, className, size = "md", showLabel = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor =
    clamped === 100 ? "bg-success" : clamped >= 50 ? "bg-brand-green" : "bg-blue-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-1 rounded-full bg-gray-100", size === "sm" ? "h-1.5" : "h-2")}>
        <div
          className={cn("rounded-full transition-all", barColor, size === "sm" ? "h-1.5" : "h-2")}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{clamped}%</span>}
    </div>
  );
}
