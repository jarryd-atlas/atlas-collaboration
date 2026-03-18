"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { PRIORITIES, ATLAS_MILESTONE_TEMPLATES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";

interface CreateMilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  siteName: string;
}

export function CreateMilestoneDialog({ open, onClose, siteName }: CreateMilestoneDialogProps) {
  const [useTemplate, setUseTemplate] = useState(false);
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
        <DialogHeader onClose={onClose}>Add Milestone to {siteName}</DialogHeader>
        <DialogBody className="space-y-4">
          {/* Template toggle */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">
              <input
                type="checkbox"
                checked={useTemplate}
                onChange={(e) => setUseTemplate(e.target.checked)}
                className="mr-2 rounded border-gray-300"
              />
              Use ATLAS template
            </label>
          </div>

          {useTemplate ? (
            <Select
              id="ms-template"
              label="Template"
              options={ATLAS_MILESTONE_TEMPLATES.map((t) => ({
                value: t.name,
                label: `${t.order}. ${t.name} — ${t.description}`,
              }))}
            />
          ) : (
            <Input
              id="ms-name"
              label="Milestone Name"
              placeholder="e.g. Energy Optimization Study"
              required
            />
          )}

          <Textarea
            id="ms-description"
            label="Description"
            placeholder="What does this milestone cover?"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input id="ms-start" label="Start Date" type="date" />
            <Input id="ms-due" label="Due Date" type="date" />
          </div>

          <Select
            id="ms-priority"
            label="Priority"
            options={PRIORITIES.map((p) => ({
              value: p,
              label: formatLabel(p),
            }))}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Milestone"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
