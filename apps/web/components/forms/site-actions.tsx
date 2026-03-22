"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { ChangeStageDialog } from "./change-stage-dialog";
import { Plus } from "lucide-react";
import type { SitePipelineStage } from "@repo/shared";

interface AddMilestoneButtonProps {
  siteName: string;
  siteId: string;
  tenantId: string;
}

export function AddMilestoneButton({ siteName, siteId, tenantId }: AddMilestoneButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add Milestone
      </Button>
      <CreateMilestoneDialog
        open={open}
        onClose={() => setOpen(false)}
        siteName={siteName}
        siteId={siteId}
        tenantId={tenantId}
      />
    </>
  );
}

interface ChangeStageButtonProps {
  siteName: string;
  siteId: string;
  currentStage: SitePipelineStage;
}

export function ChangeStageButton({ siteName, siteId, currentStage }: ChangeStageButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change Stage
      </Button>
      <ChangeStageDialog
        open={open}
        onClose={() => setOpen(false)}
        siteName={siteName}
        siteId={siteId}
        currentStage={currentStage}
      />
    </>
  );
}
