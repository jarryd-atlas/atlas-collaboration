"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function SlidePanel({ open, onClose, children, width = "max-w-md" }: SlidePanelProps) {
  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 bg-white border-l border-gray-200 shadow-xl w-full flex flex-col",
          "transition-transform duration-200 ease-out",
          width,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {open && children}
      </div>
    </>,
    document.body,
  );
}

export function SlidePanelHeader({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
      <h2 className="text-base font-bold text-gray-900 truncate pr-4">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function SlidePanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      {children}
    </div>
  );
}
