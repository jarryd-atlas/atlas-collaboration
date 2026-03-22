"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CreateCustomerDialog } from "../forms/create-customer-dialog";
import { QuickTaskDialog } from "../forms/quick-task-dialog";
import { QuickFlagIssueDialog } from "../forms/quick-flag-issue-dialog";
import { VoiceRecordDialog } from "../forms/voice-record-dialog";
import { usePageContext } from "./page-context";

interface QuickActionsProps {
  /** Whether the user is a CK internal user (shows "Create Customer" option) */
  isInternal?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  internalOnly?: boolean;
}

export function QuickActions({ isInternal = false }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCtx = usePageContext();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Keyboard shortcuts: Escape to close, Cmd+J / Ctrl+J for Quick Task
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
      // Cmd+J (Mac) / Ctrl+J (Win/Linux) to open Quick Task
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsOpen(false);
        setActiveDialog("create-task");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function openDialog(id: string) {
    setIsOpen(false);
    setActiveDialog(id);
  }

  const actions: QuickAction[] = [
    {
      id: "create-task",
      label: "Quick Task",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      onClick: () => openDialog("create-task"),
    },
    {
      id: "voice-note",
      label: "Record Voice Note",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
      onClick: () => openDialog("voice-note"),
    },
    {
      id: "flag-issue",
      label: "Flag Issue",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
      ),
      onClick: () => openDialog("flag-issue"),
    },
    {
      id: "create-customer",
      label: "Add Company",
      internalOnly: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      ),
      onClick: () => openDialog("create-customer"),
    },
  ];

  const visibleActions = actions.filter(
    (a) => !a.internalOnly || isInternal
  );

  return (
    <>
      <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
        {/* Backdrop overlay when menu is open */}
        <div
          className={`fixed inset-0 transition-opacity duration-200 ${
            isOpen
              ? "bg-black/20 pointer-events-auto"
              : "bg-transparent pointer-events-none"
          }`}
          style={{ zIndex: -1 }}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />

        {/* Action menu items */}
        <div
          className="absolute bottom-16 right-0 flex flex-col items-end gap-2 mb-2"
          role="menu"
          aria-label="Quick actions"
        >
          {visibleActions.map((action, index) => {
            const reverseIndex = visibleActions.length - 1 - index;
            const delay = reverseIndex * 40;

            return (
              <div
                key={action.id}
                className="flex items-center gap-3 transition-all duration-200"
                style={{
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen
                    ? "translateY(0) scale(1)"
                    : "translateY(12px) scale(0.9)",
                  transitionDelay: isOpen ? `${delay}ms` : "0ms",
                  pointerEvents: isOpen ? "auto" : "none",
                }}
                role="menuitem"
              >
                <span className="whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-lg ring-1 ring-gray-200/60">
                  {action.label}
                </span>

                <button
                  type="button"
                  onClick={action.onClick}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-all duration-150 hover:bg-gray-700 hover:scale-105 active:scale-95"
                  aria-label={action.label}
                >
                  {action.icon}
                </button>
              </div>
            );
          })}
        </div>

        {/* Main FAB button */}
        <button
          type="button"
          onClick={toggle}
          className={`group flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 ${
            isOpen
              ? "bg-gray-900 rotate-45 hover:bg-gray-700"
              : "bg-gray-900 hover:bg-gray-700 hover:scale-105"
          }`}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Dialogs */}
      <CreateCustomerDialog
        open={activeDialog === "create-customer"}
        onClose={() => setActiveDialog(null)}
      />
      <QuickTaskDialog
        open={activeDialog === "create-task"}
        onClose={() => setActiveDialog(null)}
      />
      <QuickFlagIssueDialog
        open={activeDialog === "flag-issue"}
        onClose={() => setActiveDialog(null)}
      />
      <VoiceRecordDialog
        open={activeDialog === "voice-note"}
        onClose={() => setActiveDialog(null)}
        defaultSiteId={pageCtx.siteId ?? undefined}
        defaultMilestoneId={pageCtx.milestoneId ?? undefined}
      />
    </>
  );
}
