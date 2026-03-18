"use client";

import { cn } from "../../lib/utils";
import { Avatar } from "../ui/avatar";
import { Search, Menu } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { SearchDialog } from "../search/search-dialog";
import { NotificationsDropdown } from "./notifications-dropdown";

interface TopBarProps {
  currentUser: {
    fullName: string;
    avatarUrl: string | null;
  };
  onMenuToggle?: () => void;
  breadcrumbs?: ReactNode;
}

export function TopBar({ currentUser, onMenuToggle, breadcrumbs }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-sm px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-50 text-gray-600"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumbs */}
        {breadcrumbs && (
          <nav className="hidden sm:flex items-center text-sm text-gray-400">
            {breadcrumbs}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Cmd+K search trigger */}
        <SearchTrigger />

        {/* Notifications */}
        <NotificationsDropdown />

        {/* User avatar */}
        <Avatar name={currentUser.fullName} src={currentUser.avatarUrl} size="md" />
      </div>

      {/* Search overlay */}
      <SearchDialog />
    </header>
  );
}

function SearchTrigger() {
  return (
    <button
      onClick={() => {
        // Dispatch Cmd+K to open the search dialog
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        );
      }}
      className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 hover:border-gray-300 transition-colors"
    >
      <Search className="h-4 w-4" />
      Search...
      <kbd className="hidden lg:inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 text-xs text-gray-400">
        ⌘K
      </kbd>
    </button>
  );
}

/** Breadcrumb separator */
export function BreadcrumbSep() {
  return <span className="mx-2 text-gray-300">/</span>;
}
