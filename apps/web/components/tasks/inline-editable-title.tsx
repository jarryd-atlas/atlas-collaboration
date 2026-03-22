"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateTaskTitle } from "../../lib/actions";
import { cn } from "../../lib/utils";

interface InlineEditableTitleProps {
  taskId: string;
  initialTitle: string;
  className?: string;
}

export function InlineEditableTitle({
  taskId,
  initialTitle,
  className,
}: InlineEditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Sync with server
  useEffect(() => {
    if (!isEditing) setValue(initialTitle);
  }, [initialTitle, isEditing]);

  function startEditing() {
    setIsEditing(true);
    setValue(initialTitle);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialTitle) {
      setValue(initialTitle);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    startTransition(async () => {
      const result = await updateTaskTitle(taskId, trimmed);
      if (result && "error" in result) {
        setValue(initialTitle); // revert
      }
      router.refresh();
    });
  }

  function cancel() {
    setValue(initialTitle);
    setIsEditing(false);
  }

  return (
    <div
      className={cn("min-w-0 w-full text-sm font-medium text-gray-900", className)}
      onClick={(e) => {
        if (!isEditing) {
          e.stopPropagation();
          startEditing();
        }
      }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="[font-size:inherit] [font-weight:inherit] text-gray-900 bg-white border border-brand-green/40 rounded px-1.5 py-0.5 outline-none ring-1 ring-brand-green/20 w-full"
        />
      ) : (
        <span
          className={cn(
            "truncate block cursor-text hover:bg-gray-100 rounded px-0.5 -mx-0.5 transition-colors",
            isPending && "opacity-50",
          )}
          title="Click to edit"
        >
          {value}
        </span>
      )}
    </div>
  );
}
