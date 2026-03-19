"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface QuickActionsProps {
  /** Whether the user is a CK internal user (shows "Create Customer" option) */
  isInternal?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  internalOnly?: boolean;
}

export function QuickActions({ isInternal = false }: QuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
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

  const actions: QuickAction[] = [
    {
      id: "create-task",
      label: "Create Task",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
      onClick: () => {
        // TODO: open task creation modal/sheet
        setIsOpen(false);
      },
    },
    {
      id: "voice-note",
      label: "Record Voice Note",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
      onClick: () => {
        // TODO: open voice recording modal
        setIsOpen(false);
      },
    },
    {
      id: "typed-note",
      label: "Add Typed Note",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      ),
      onClick: () => {
        // TODO: open typed note modal
        setIsOpen(false);
      },
    },
    {
      id: "flag-issue",
      label: "Flag Issue",
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
      ),
      onClick: () => {
        // TODO: open issue flagging modal
        setIsOpen(false);
      },
    },
    {
      id: "create-customer",
      label: "Create Customer",
      internalOnly: true,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      ),
      onClick: () => {
        router.push("/customers/new");
        setIsOpen(false);
      },
    },
  ];

  const visibleActions = actions.filter(
    (a) => !a.internalOnly || isInternal
  );

  return (
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
          // Stagger animation: bottom items appear first
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
              {/* Label pill */}
              <span className="whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-lg ring-1 ring-gray-200/60">
                {action.label}
              </span>

              {/* Icon circle */}
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
  );
}
