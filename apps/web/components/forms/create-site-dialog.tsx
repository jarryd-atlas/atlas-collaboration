"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { SITE_PIPELINE_STAGES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";

interface CreateSiteDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
}

export function CreateSiteDialog({ open, onClose, customerName }: CreateSiteDialogProps) {
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
        <DialogHeader onClose={onClose}>Add Site to {customerName}</DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            id="site-name"
            label="Site Name"
            placeholder="e.g. Denver Distribution Center"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input id="site-city" label="City" placeholder="Denver" />
            <Input id="site-state" label="State" placeholder="CO" />
          </div>
          <Input id="site-address" label="Address" placeholder="4800 Brighton Blvd" />
          <Select
            id="site-stage"
            label="Pipeline Stage"
            options={SITE_PIPELINE_STAGES.map((s) => ({
              value: s,
              label: formatLabel(s),
            }))}
          />
          <Textarea
            id="site-notes"
            label="Notes"
            placeholder="Any additional notes about this site..."
            rows={3}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Site"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
