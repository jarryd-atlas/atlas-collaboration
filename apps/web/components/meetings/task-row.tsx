"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { updateTaskStatus } from "../../lib/actions/tasks";

interface TaskRowProps {
  task: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    site_id: string | null;
    assignee: { id: string; full_name: string; avatar_url: string | null } | null;
    siteName: string | null;
  };
}

export function TaskRow({ task }: TaskRowProps) {
  const router = useRouter();
  const [completing, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const now = new Date().toISOString().split("T")[0]!;
  const isOverdue = task.due_date ? task.due_date < now : false;

  function handleComplete() {
    setCompleted(true);
    startTransition(async () => {
      await updateTaskStatus(task.id, "done");
      router.refresh();
    });
  }

  if (completed) return null;

  return (
    <div className="group flex items-start gap-2 py-1 px-1 -mx-1 rounded hover:bg-gray-50/50 transition-colors">
      {/* Complete checkbox */}
      <button
        onClick={handleComplete}
        disabled={completing}
        className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded border border-gray-300 hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
      />

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs text-gray-600 leading-snug ${completing ? "opacity-50" : ""}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.siteName && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <MapPin className="h-2.5 w-2.5" />
              {task.siteName}
            </span>
          )}
          {task.assignee && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
              <Avatar
                name={task.assignee.full_name}
                src={task.assignee.avatar_url}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              {task.assignee.full_name}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
              {isOverdue ? "Overdue · " : "Due "}
              {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {task.status === "in_progress" && (
            <span className="text-[10px] text-blue-500">In progress</span>
          )}
        </div>
      </div>
    </div>
  );
}
