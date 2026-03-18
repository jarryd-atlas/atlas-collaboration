"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { CreateTaskDialog } from "./create-task-dialog";
import { Plus } from "lucide-react";
interface AddTaskButtonProps {
  milestoneName: string;
  assignableUsers: Array<{ id: string; full_name: string; avatar_url: string | null; [key: string]: unknown }>;
}

export function AddTaskButton({ milestoneName, assignableUsers }: AddTaskButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Task
      </Button>
      <CreateTaskDialog
        open={open}
        onClose={() => setOpen(false)}
        milestoneName={milestoneName}
        assignableUsers={assignableUsers}
      />
    </>
  );
}
