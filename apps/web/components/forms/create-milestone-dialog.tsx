"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea, Select } from "../ui/input";
import { Combobox } from "../ui/combobox";
import type { ComboboxOption } from "../ui/combobox";
import { Button } from "../ui/button";
import { PRIORITIES, ATLAS_MILESTONE_TEMPLATES } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { createMilestone } from "../../lib/actions";

interface CreateMilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  /** When provided, milestone is scoped to this site (site-level context) */
  siteId?: string;
  siteName?: string;
  /** When provided, user can choose a site (customer-level context) */
  sites?: Array<{ id: string; name: string; tenant_id: string }>;
  customerName?: string;
}

export function CreateMilestoneDialog({
  open,
  onClose,
  tenantId,
  siteId,
  siteName,
  sites,
  customerName,
}: CreateMilestoneDialogProps) {
  const [useTemplate, setUseTemplate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState(siteId ?? "");
  const router = useRouter();

  // Determine if we're in site-level mode (siteId given) or customer-level (sites list given)
  const isCustomerLevel = !siteId && sites && sites.length > 0;

  const siteOptions: ComboboxOption[] = (sites ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const resolvedSiteId = siteId ?? selectedSiteId;
  const resolvedSiteName = siteName ?? sites?.find((s) => s.id === selectedSiteId)?.name;
  const resolvedTenantId = siteId
    ? tenantId
    : sites?.find((s) => s.id === selectedSiteId)?.tenant_id ?? tenantId;

  // Header text
  const headerText = isCustomerLevel
    ? `New Milestone for ${customerName ?? "Company"}`
    : `Add Milestone to ${siteName ?? "Site"}`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!resolvedSiteId) {
      setError("Please select a site.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("siteId", resolvedSiteId);
    formData.set("tenantId", resolvedTenantId);

    // If using template, set the name from the template selection
    if (useTemplate) {
      const templateName = formData.get("templateName") as string;
      formData.set("name", templateName);
      formData.delete("templateName");
    }

    startTransition(async () => {
      const result = await createMilestone(formData);
      if ("error" in result) {
        setError(result.error ?? "Unknown error");
      } else {
        onClose();
        setSelectedSiteId(siteId ?? "");
        router.refresh();
      }
    });
  }

  function handleClose() {
    setError("");
    setSelectedSiteId(siteId ?? "");
    setUseTemplate(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={handleClose}>{headerText}</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Site selector (customer-level only) */}
          {isCustomerLevel && (
            <Combobox
              id="ms-site"
              label="Site"
              placeholder="Search sites..."
              options={siteOptions}
              value={selectedSiteId}
              onChange={setSelectedSiteId}
              clearable={false}
            />
          )}

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
              name="templateName"
              label="Template"
              options={ATLAS_MILESTONE_TEMPLATES.map((t) => ({
                value: t.name,
                label: `${t.order}. ${t.name} — ${t.description}`,
              }))}
            />
          ) : (
            <Input
              id="ms-name"
              name="name"
              label="Milestone Name"
              placeholder="e.g. Energy Optimization Study"
              required
            />
          )}

          <Textarea
            id="ms-description"
            name="description"
            label="Description"
            placeholder="What does this milestone cover?"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input id="ms-start" name="startDate" label="Start Date" type="date" />
            <Input id="ms-due" name="dueDate" label="Due Date" type="date" />
          </div>

          <Select
            id="ms-priority"
            name="priority"
            label="Priority"
            options={PRIORITIES.map((p) => ({
              value: p,
              label: formatLabel(p),
            }))}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create Milestone"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
