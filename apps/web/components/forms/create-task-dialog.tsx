"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { PRIORITIES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
  milestoneName: string;
  assignableUsers: Array<{ id: string; full_name: string; [key: string]: unknown }>;
}

export function CreateTaskDialog({ open, onClose, milestoneName, assignableUsers }: CreateTaskDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: Replace with Supabase insert
    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 500);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Add Task to {milestoneName}</DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            id="task-title"
            label="Task Title"
            placeholder="e.g. Install sensor array in Zone B"
            required
          />
          <Textarea
            id="task-description"
            label="Description"
            placeholder="Describe what needs to be done..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              id="task-priority"
              label="Priority"
              options={PRIORITIES.map((p) => ({
                value: p,
                label: formatLabel(p),
              }))}
            />
            <Select
              id="task-assignee"
              label="Assignee"
              options={[
                { value: "", label: "Unassigned" },
                ...assignableUsers.map((u) => ({
                  value: u.id,
                  label: u.full_name,
                })),
              ]}
            />
          </div>
          <Input id="task-due" label="Due Date" type="date" />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
