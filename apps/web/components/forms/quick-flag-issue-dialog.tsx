"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Button } from "../ui/button";
import { SEVERITY_LEVELS } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { createFlaggedIssue, fetchSitesList } from "../../lib/actions";

interface QuickFlagIssueDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SiteOption {
  id: string;
  name: string;
  tenant_id: string;
}

/**
 * Quick Flag Issue dialog opened from the FAB.
 * Fetches sites via server action so it can be used from any page.
 */
export function QuickFlagIssueDialog({ open, onClose }: QuickFlagIssueDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");

    fetchSitesList().then((result) => {
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.sites as SiteOption[];
        setSites(data);
        if (data.length > 0 && data[0]) {
          setSelectedSiteId(data[0].id);
        }
      }
      setLoading(false);
    });
  }, [open]);

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
        handleClose();
        router.refresh();
      }
    });
  }

  function handleClose() {
    setError("");
    setSelectedSiteId("");
    setSites([]);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={handleClose}>Flag an Issue</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Loading sites...
            </div>
          ) : sites.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No sites found. Create a site first.
            </div>
          ) : (
            <>
              <Select
                id="fi-site"
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
                id="fi-severity"
                name="severity"
                label="Severity"
                options={SEVERITY_LEVELS.map((s) => ({
                  value: s,
                  label: formatLabel(s),
                }))}
              />
              <Input
                id="fi-summary"
                name="summary"
                label="Summary"
                placeholder="Brief description of the issue"
                required
              />
              <Textarea
                id="fi-details"
                name="details"
                label="Details"
                placeholder="Provide more context, measurements, observations..."
                rows={4}
              />
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isPending || loading || sites.length === 0}
          >
            {isPending ? "Flagging..." : "Flag Issue"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
