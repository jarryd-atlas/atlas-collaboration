"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateTaskTitle } from "../../lib/actions";
import { cn } from "../../lib/utils";

interface InlineEditableTitleProps {
  taskId: string;
  initialTitle: string;
  className?: string;
  /** Single click to edit (default: double-click) */
  singleClickEdit?: boolean;
}

export function InlineEditableTitle({
  taskId,
  initialTitle,
  className,
  singleClickEdit = false,
}: InlineEditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Sync with server
  useEffect(() => {
    if (!isEditing) setValue(initialTitle);
  }, [initialTitle, isEditing]);

  function startEditing() {
    setIsEditing(true);
    setValue(initialTitle);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
        autoResize(textareaRef.current);
      }
    });
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
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

  const clickHandler = singleClickEdit
    ? {
        onClick: (e: React.MouseEvent) => {
          if (!isEditing) {
            e.stopPropagation();
            startEditing();
          }
        },
      }
    : {
        onDoubleClick: (e: React.MouseEvent) => {
          if (!isEditing) {
            e.stopPropagation();
            startEditing();
          }
        },
      };

  return (
    <div
      className={cn("min-w-0 w-full text-sm font-medium text-gray-900", className)}
      {...clickHandler}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize(e.target);
          }}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          rows={1}
          className="text-sm font-medium text-gray-900 bg-white border border-brand-green/40 rounded px-1.5 py-0.5 outline-none ring-1 ring-brand-green/20 w-full min-w-[200px] resize-none overflow-hidden"
        />
      ) : (
        <span
          className={cn(
            "block rounded px-0.5 -mx-0.5 transition-colors",
            singleClickEdit ? "cursor-pointer hover:bg-gray-100" : "cursor-text hover:bg-gray-100",
            isPending && "opacity-50",
          )}
          title={singleClickEdit ? "Click to edit" : "Double-click to edit"}
        >
          {value}
        </span>
      )}
    </div>
  );
}
