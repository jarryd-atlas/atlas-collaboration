"use client";

import { useState, useEffect } from "react";
import { ChevronDown, FileText } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  count?: number;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  highlighted?: boolean;
  children: React.ReactNode;
  sourceDocuments?: Array<{ file_name: string }>;
  badge?: string;
}

export function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  forceOpen,
  highlighted = false,
  children,
  sourceDocuments,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Allow parent to force open (e.g., when new data arrives)
  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-colors ${
        highlighted
          ? "border-green-300 ring-1 ring-green-200"
          : "border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              {count}
            </span>
          )}
          {sourceDocuments && sourceDocuments.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <FileText className="h-3 w-3" />
              AI extracted
            </span>
          )}
          {badge && (
            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}
