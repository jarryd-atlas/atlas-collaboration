"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, X } from "lucide-react";
import { updateTaskDueDate } from "../../lib/actions";
import { cn } from "../../lib/utils";

interface TaskDueDatePickerProps {
  taskId: string;
  currentDueDate: string | null;
}

export function TaskDueDatePicker({ taskId, currentDueDate }: TaskDueDatePickerProps) {
  const [optimisticDate, setOptimisticDate] = useState(currentDueDate ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setOptimisticDate(currentDueDate ?? "");
  }, [currentDueDate]);

  function handleChange(date: string) {
    setOptimisticDate(date);
    startTransition(async () => {
      const result = await updateTaskDueDate(taskId, date || null);
      if (result && "error" in result) {
        setOptimisticDate(currentDueDate ?? "");
      }
      router.refresh();
    });
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  return (
    <div
      className="relative shrink-0 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <label
        className={cn(
          "flex items-center gap-1 text-xs cursor-pointer hover:bg-gray-100 rounded px-1.5 py-0.5 transition-colors",
          isPending && "opacity-50",
          optimisticDate ? "text-gray-500" : "text-gray-300 hover:text-gray-400",
        )}
        title="Set due date"
      >
        <Calendar className="h-3 w-3" />
        <span>{optimisticDate ? formatDate(optimisticDate) : "Date"}</span>
        <input
          type="date"
          value={optimisticDate}
          onChange={(e) => handleChange(e.target.value)}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onFocus={(e) => e.target.showPicker?.()}
        />
      </label>
      {optimisticDate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleChange("");
          }}
          className="text-gray-300 hover:text-gray-500 p-0.5"
          title="Clear due date"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
