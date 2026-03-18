"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Sidebar panel */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md hover:bg-gray-100 text-gray-400 z-10"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
