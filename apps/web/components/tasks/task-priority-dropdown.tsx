"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PriorityBadge } from "../ui/badge";
import { updateTaskPriority } from "../../lib/actions";
import { cn } from "../../lib/utils";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

interface TaskPriorityDropdownProps {
  taskId: string;
  currentPriority: string;
}

export function TaskPriorityDropdown({ taskId, currentPriority }: TaskPriorityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticPriority, setOptimisticPriority] = useState(currentPriority);
  const [isPending, startTransition] = useTransition();
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setOptimisticPriority(currentPriority);
  }, [currentPriority]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function handleSelect(priority: string) {
    if (priority === optimisticPriority) {
      setIsOpen(false);
      return;
    }

    setOptimisticPriority(priority);
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateTaskPriority(taskId, priority);
      if (result && "error" in result) {
        setOptimisticPriority(currentPriority);
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
        onClick={() => {
          if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setOpenUp(rect.bottom + 180 > window.innerHeight);
          }
          setIsOpen(!isOpen);
        }}
        className={cn(
          "cursor-pointer transition-opacity",
          isPending && "opacity-50",
        )}
        title="Change priority"
      >
        <PriorityBadge priority={optimisticPriority} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute right-0 w-32 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden",
          openUp ? "bottom-full mb-1" : "top-full mt-1",
        )}>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleSelect(p.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2",
                p.value === optimisticPriority && "bg-brand-green/5 font-medium",
              )}
            >
              <PriorityBadge priority={p.value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
