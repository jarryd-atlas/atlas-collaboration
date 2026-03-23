"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X, ListTodo } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { createTasksBatch } from "../../../../../lib/actions";

interface ExtractedTask {
  id: string;
  title: string;
  description?: string;
  assignee_name?: string | null;
  assigneeName?: string | null;
  assigneeHint?: string | null;
  due_date?: string | null;
  dueDate?: string | null;
  priority: string;
  status: string;
}

const priorityColors: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-amber-600",
  urgent: "text-red-600",
};

export function ExtractedTasksSection({
  tasks: initialTasks,
  voiceNoteId,
  siteId,
  milestoneId,
  tenantId,
}: {
  tasks: ExtractedTask[];
  voiceNoteId: string;
  siteId?: string | null;
  milestoneId?: string | null;
  tenantId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveAllLoading, setApproveAllLoading] = useState(false);
  const router = useRouter();

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const hasAnyPending = pendingTasks.length > 0;

  async function handleApprove(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setApproving(taskId);
    const result = await createTasksBatch([
      {
        title: task.title,
        description: task.description,
        priority: task.priority,
        siteId: siteId ?? undefined,
        milestoneId: milestoneId ?? undefined,
        tenantId,
      },
    ]);

    if (result && !("error" in result)) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "approved" } : t)),
      );
      router.refresh();
    }
    setApproving(null);
  }

  async function handleApproveAll() {
    setApproveAllLoading(true);
    const batch = pendingTasks.map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
      siteId: siteId ?? undefined,
      milestoneId: milestoneId ?? undefined,
      tenantId,
    }));

    const result = await createTasksBatch(batch);
    if (result && !("error" in result)) {
      setTasks((prev) =>
        prev.map((t) => (t.status === "pending" ? { ...t, status: "approved" } : t)),
      );
      router.refresh();
    }
    setApproveAllLoading(false);
  }

  function handleDismiss(taskId: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "dismissed" } : t)),
    );
  }

  if (tasks.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-card lg:col-span-2">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-brand-green" />
          <h2 className="text-base font-semibold text-gray-900">
            Extracted Tasks ({tasks.length})
          </h2>
        </div>
        {hasAnyPending && (
          <Button
            variant="primary"
            size="sm"
            className="gap-1 text-xs"
            onClick={handleApproveAll}
            disabled={approveAllLoading}
          >
            <Check className="h-3 w-3" />
            {approveAllLoading ? "Creating..." : `Approve All (${pendingTasks.length})`}
          </Button>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.map((task) => {
          const assigneeName = task.assignee_name ?? task.assigneeName ?? task.assigneeHint ?? null;
          const dueDate = task.due_date ?? task.dueDate ?? null;

          return (
            <div key={task.id} className="flex items-center justify-between px-6 py-3 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  <span className={`text-xs font-medium capitalize ${priorityColors[task.priority] ?? "text-gray-500"}`}>
                    {task.priority}
                  </span>
                </div>
                {(assigneeName || dueDate || task.description) && (
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                    {assigneeName && <span>Assigned to {assigneeName}</span>}
                    {dueDate && <span>Due {dueDate}</span>}
                  </div>
                )}
                {task.description && (
                  <p className="mt-0.5 text-xs text-gray-500 truncate">{task.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.status === "pending" ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => handleApprove(task.id)}
                      disabled={approving === task.id}
                    >
                      <Check className="h-3 w-3" />
                      {approving === task.id ? "Creating..." : "Approve"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 text-xs"
                      onClick={() => handleDismiss(task.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : task.status === "approved" ? (
                  <Badge variant="success" className="gap-1">
                    <Check className="h-3 w-3" />
                    Created
                  </Badge>
                ) : (
                  <Badge variant="default">Dismissed</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
