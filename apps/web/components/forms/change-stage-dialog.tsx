"use client";

import { useState } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Textarea } from "../ui/input";
import { Button } from "../ui/button";
import { SITE_PIPELINE_STAGES } from "@repo/shared";
import type { SitePipelineStage } from "@repo/shared";
import { formatLabel } from "../../lib/utils";

interface ChangeStageDialogProps {
  open: boolean;
  onClose: () => void;
  siteName: string;
  currentStage: SitePipelineStage;
}

export function ChangeStageDialog({ open, onClose, siteName, currentStage }: ChangeStageDialogProps) {
  const [selected, setSelected] = useState<SitePipelineStage>(currentStage);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    // TODO: Replace with Supabase update
    setTimeout(() => {
      setSubmitting(false);
      onClose();
    }, 500);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader onClose={onClose}>Change Pipeline Stage</DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-gray-500">
            Move <span className="font-medium text-gray-900">{siteName}</span> to a new pipeline stage.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SITE_PIPELINE_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setSelected(stage)}
                className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
                  selected === stage
                    ? "border-brand-green bg-brand-green/5 text-gray-900 font-medium"
                    : stage === currentStage
                      ? "border-gray-200 bg-gray-50 text-gray-500"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {formatLabel(stage)}
                {stage === currentStage && (
                  <span className="text-xs text-gray-400 ml-1">(current)</span>
                )}
              </button>
            ))}
          </div>

          {selected === "disqualified" && (
            <Textarea
              id="dq-reason"
              label="Disqualification Reason"
              placeholder="Why is this site being disqualified?"
              rows={2}
              required
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || selected === currentStage}>
            {submitting ? "Updating..." : "Update Stage"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
