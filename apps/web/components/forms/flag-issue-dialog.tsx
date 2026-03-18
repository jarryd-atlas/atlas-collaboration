"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { SEVERITY_LEVELS } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import type { Site } from "../../lib/mock-data";

interface FlagIssueDialogProps {
  open: boolean;
  onClose: () => void;
  sites: Site[];
  /** Pre-selected site ID (when flagging from a site page) */
  defaultSiteId?: string;
}

export function FlagIssueDialog({ open, onClose, sites, defaultSiteId }: FlagIssueDialogProps) {
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
        <DialogHeader onClose={onClose}>Flag an Issue</DialogHeader>
        <DialogBody className="space-y-4">
          <Select
            id="issue-site"
            label="Site"
            defaultValue={defaultSiteId}
            options={sites.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
          />
          <Select
            id="issue-severity"
            label="Severity"
            options={SEVERITY_LEVELS.map((s) => ({
              value: s,
              label: formatLabel(s),
            }))}
          />
          <Input
            id="issue-summary"
            label="Summary"
            placeholder="Brief description of the issue"
            required
          />
          <Textarea
            id="issue-details"
            label="Details"
            placeholder="Provide more context, measurements, observations..."
            rows={4}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={submitting}>
            {submitting ? "Flagging..." : "Flag Issue"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
