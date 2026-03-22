"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "../ui/badge";
import { updateTaskStatus } from "../../lib/actions";
import { cn } from "../../lib/utils";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
] as const;

interface TaskStatusDropdownProps {
  taskId: string;
  currentStatus: string;
}

export function TaskStatusDropdown({ taskId, currentStatus }: TaskStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Sync with server value
  useEffect(() => {
    setOptimisticStatus(currentStatus);
  }, [currentStatus]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function handleSelect(status: string) {
    if (status === optimisticStatus) {
      setIsOpen(false);
      return;
    }

    setOptimisticStatus(status);
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateTaskStatus(taskId, status as any);
      if (result && "error" in result) {
        setOptimisticStatus(currentStatus); // revert
      }
      router.refresh();
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "cursor-pointer transition-opacity",
          isPending && "opacity-50",
        )}
        title="Change status"
      >
        <StatusBadge status={optimisticStatus} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleSelect(s.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2",
                s.value === optimisticStatus && "bg-brand-green/5 font-medium",
              )}
            >
              <StatusBadge status={s.value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
