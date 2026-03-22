"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { SEVERITY_LEVELS } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { createFlaggedIssue } from "../../lib/actions";

interface FlagIssueDialogProps {
  open: boolean;
  onClose: () => void;
  sites: Array<{ id: string; name: string; tenant_id: string; [key: string]: unknown }>;
  /** Pre-selected site ID (when flagging from a site page) */
  defaultSiteId?: string;
}

export function FlagIssueDialog({ open, onClose, sites, defaultSiteId }: FlagIssueDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId || (sites[0]?.id ?? ""));
  const router = useRouter();

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("siteId", selectedSiteId);
    if (selectedSite) {
      formData.set("tenantId", selectedSite.tenant_id);
    }

    startTransition(async () => {
      const result = await createFlaggedIssue(formData);
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
        <DialogHeader onClose={onClose}>Flag an Issue</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Select
            id="issue-site"
            label="Site"
            value={selectedSiteId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedSiteId(e.target.value)
            }
            options={sites.map((s) => ({
              value: s.id,
              label: s.name,
            }))}
          />
          <Select
            id="issue-severity"
            name="severity"
            label="Severity"
            options={SEVERITY_LEVELS.map((s) => ({
              value: s,
              label: formatLabel(s),
            }))}
          />
          <Input
            id="issue-summary"
            name="summary"
            label="Summary"
            placeholder="Brief description of the issue"
            required
          />
          <Textarea
            id="issue-details"
            name="details"
            label="Details"
            placeholder="Provide more context, measurements, observations..."
            rows={4}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={isPending}>
            {isPending ? "Flagging..." : "Flag Issue"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
