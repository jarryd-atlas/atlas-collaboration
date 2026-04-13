"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PipelineStageBadge } from "../ui/badge";
import { updateSitePipelineStage } from "../../lib/actions";
import { cn } from "../../lib/utils";
import type { PipelineStage } from "@repo/supabase";

const STAGES: { value: PipelineStage; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "evaluation", label: "Evaluation" },
  { value: "qualified", label: "Qualified" },
  { value: "contracted", label: "Contracted" },
  { value: "deployment", label: "Deployment" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disqualified", label: "Disqualified" },
];

interface SitePipelineStageDropdownProps {
  siteId: string;
  currentStage: string;
}

export function SitePipelineStageDropdown({ siteId, currentStage }: SitePipelineStageDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticStage, setOptimisticStage] = useState(currentStage);
  const [isPending, startTransition] = useTransition();
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setOptimisticStage(currentStage);
  }, [currentStage]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function handleSelect(stage: PipelineStage) {
    if (stage === optimisticStage) {
      setIsOpen(false);
      return;
    }

    setOptimisticStage(stage);
    setIsOpen(false);

    startTransition(async () => {
      const result = await updateSitePipelineStage(siteId, stage);
      if (result && "error" in result) {
        setOptimisticStage(currentStage);
      }
      router.refresh();
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setOpenUp(rect.bottom + 320 > window.innerHeight);
          }
          setIsOpen(!isOpen);
        }}
        className={cn(
          "cursor-pointer transition-opacity",
          isPending && "opacity-50",
        )}
        title="Change pipeline stage"
      >
        <PipelineStageBadge stage={optimisticStage} />
      </button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 w-40 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden",
          openUp ? "bottom-full mb-1" : "top-full mt-1",
        )}>
          {STAGES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleSelect(s.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2",
                s.value === optimisticStage && "bg-brand-green/5 font-medium",
              )}
            >
              <PipelineStageBadge stage={s.value} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
