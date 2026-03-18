"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { CreateMilestoneDialog } from "./create-milestone-dialog";
import { ChangeStageDialog } from "./change-stage-dialog";
import { Plus } from "lucide-react";
import type { SitePipelineStage } from "@repo/shared";

interface AddMilestoneButtonProps {
  siteName: string;
}

export function AddMilestoneButton({ siteName }: AddMilestoneButtonProps) {
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
      />
    </>
  );
}

interface ChangeStageButtonProps {
  siteName: string;
  currentStage: SitePipelineStage;
}

export function ChangeStageButton({ siteName, currentStage }: ChangeStageButtonProps) {
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
        currentStage={currentStage}
      />
    </>
  );
}
