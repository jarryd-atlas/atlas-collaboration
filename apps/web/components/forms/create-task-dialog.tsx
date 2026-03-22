"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { Combobox } from "../ui/combobox";
import { PRIORITIES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { createTask } from "../../lib/actions";

interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  milestoneName: string;
  milestoneId: string;
  tenantId: string;
  assignableUsers: Array<{ id: string; full_name: string; group?: string; [key: string]: unknown }>;
}

export function CreateTaskDialog({
  open,
  onClose,
  milestoneName,
  milestoneId,
  tenantId,
  assignableUsers,
}: CreateTaskDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("milestoneId", milestoneId);
    formData.set("tenantId", tenantId);
    if (assigneeId) formData.set("assigneeId", assigneeId);

    startTransition(async () => {
      const result = await createTask(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Add Task to {milestoneName}</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            id="task-title"
            name="title"
            label="Task Title"
            placeholder="e.g. Install sensor array in Zone B"
            required
          />
          <Textarea
            id="task-description"
            name="description"
            label="Description"
            placeholder="Describe what needs to be done..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="task-priority"
              name="priority"
              label="Priority"
              options={PRIORITIES.map((p) => ({
                value: p,
                label: formatLabel(p),
              }))}
            />
            <Combobox
              id="task-assignee"
              label="Assignee"
              placeholder="Search assignees..."
              value={assigneeId}
              onChange={setAssigneeId}
              options={assignableUsers.map((u) => ({
                value: u.id,
                label: u.full_name,
                group: u.group,
              }))}
            />
          </div>
          <Input id="task-due" name="dueDate" label="Due Date" type="date" />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
