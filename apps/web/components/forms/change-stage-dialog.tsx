"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Input, Textarea } from "../ui/input";
import { Button } from "../ui/button";
import { SITE_PIPELINE_STAGES } from "@repo/shared";
import type { SitePipelineStage } from "@repo/shared";
import { formatLabel } from "../../lib/utils";
import { updateSitePipelineStage } from "../../lib/actions";

interface ChangeStageDialogProps {
  open: boolean;
  onClose: () => void;
  siteName: string;
  siteId: string;
  currentStage: SitePipelineStage;
}

export function ChangeStageDialog({ open, onClose, siteName, siteId, currentStage }: ChangeStageDialogProps) {
  const [selected, setSelected] = useState<SitePipelineStage>(currentStage);
  const [dqReason, setDqReason] = useState("");
  const [dqReevalDate, setDqReevalDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await updateSitePipelineStage(
        siteId,
        selected,
        selected === "disqualified" ? dqReason : undefined,
        selected === "disqualified" ? dqReevalDate : undefined,
      );
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
        <DialogHeader onClose={onClose}>Change Pipeline Stage</DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-500">
            Move <span className="font-medium text-gray-900">{siteName}</span> to a new pipeline stage.
          </p>
          {currentStage === "whitespace" && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-500">
              This site has no linked HubSpot deal. Link a deal to set its pipeline stage, or select a stage below to manually set it.
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {SITE_PIPELINE_STAGES.filter((s) => s !== "whitespace").map((stage) => (
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
            <>
              <Textarea
                id="dq-reason"
                name="dqReason"
                label="Disqualification Reason"
                placeholder="Why is this site being disqualified?"
                value={dqReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDqReason(e.target.value)}
                rows={2}
                required
              />
              <Input
                id="dq-reeval"
                name="dqReevalDate"
                label="Re-evaluation Date (optional)"
                type="date"
                value={dqReevalDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDqReevalDate(e.target.value)}
              />
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || selected === currentStage}>
            {isPending ? "Updating..." : "Update Stage"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
