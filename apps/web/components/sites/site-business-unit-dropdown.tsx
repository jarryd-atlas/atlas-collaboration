"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignSiteBusinessUnit } from "../../lib/actions/business-units";
import { cn } from "../../lib/utils";

interface BusinessUnit {
  id: string;
  name: string;
}

interface SiteBusinessUnitDropdownProps {
  siteId: string;
  currentBusinessUnitId: string | null;
  currentBusinessUnitName: string | null;
  businessUnits: BusinessUnit[];
}

export function SiteBusinessUnitDropdown({
  siteId,
  currentBusinessUnitId,
  currentBusinessUnitName,
  businessUnits,
}: SiteBusinessUnitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticName, setOptimisticName] = useState(currentBusinessUnitName);
  const [optimisticId, setOptimisticId] = useState(currentBusinessUnitId);
  const [isPending, startTransition] = useTransition();
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setOptimisticName(currentBusinessUnitName);
    setOptimisticId(currentBusinessUnitId);
  }, [currentBusinessUnitName, currentBusinessUnitId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  function handleSelect(buId: string | null, buName: string | null) {
    if (buId === optimisticId) {
      setIsOpen(false);
      return;
    }

    setOptimisticId(buId);
    setOptimisticName(buName);
    setIsOpen(false);

    startTransition(async () => {
      const result = await assignSiteBusinessUnit(siteId, buId);
      if (result && "error" in result) {
        setOptimisticId(currentBusinessUnitId);
        setOptimisticName(currentBusinessUnitName);
      }
      router.refresh();
    });
  }

  if (businessUnits.length === 0) {
    return <span className="text-xs text-gray-300">--</span>;
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
            setOpenUp(rect.bottom + 200 > window.innerHeight);
          }
          setIsOpen(!isOpen);
        }}
        className={cn(
          "text-xs px-1.5 py-0.5 rounded transition-all cursor-pointer",
          isPending && "opacity-50",
          optimisticName
            ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
        )}
        title="Change business unit"
      >
        {optimisticName || "--"}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute left-0 w-44 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden",
          openUp ? "bottom-full mb-1" : "top-full mt-1",
        )}>
          <button
            type="button"
            onClick={() => handleSelect(null, null)}
            className={cn(
              "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors",
              !optimisticId && "bg-brand-green/5 font-medium",
            )}
          >
            <span className="text-gray-400">None</span>
          </button>
          {businessUnits.map((bu) => (
            <button
              key={bu.id}
              type="button"
              onClick={() => handleSelect(bu.id, bu.name)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors",
                bu.id === optimisticId && "bg-brand-green/5 font-medium",
              )}
            >
              {bu.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
