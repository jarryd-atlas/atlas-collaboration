"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, ArrowRightLeft, GitMerge } from "lucide-react";
import { TransferSiteDialog } from "./transfer-site-dialog";
import { MergeSitesDialog } from "./merge-sites-dialog";

interface SiteOption {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
}

interface SiteActionsMenuProps {
  site: SiteOption;
  customerId: string;
  customerName: string;
  /** All sibling sites for merge picker */
  siblingsSites: SiteOption[];
}

export function SiteActionsMenu({ site, customerId, customerName, siblingsSites }: SiteActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }}
          className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Site actions"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setTransferOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              <ArrowRightLeft className="h-4 w-4 text-gray-400" />
              Transfer to another company
            </button>
            {siblingsSites.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setMergeOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
              >
                <GitMerge className="h-4 w-4 text-gray-400" />
                Merge with another site
              </button>
            )}
          </div>
        )}
      </div>

      <TransferSiteDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        siteId={site.id}
        siteName={site.name}
        currentCustomerId={customerId}
        currentCustomerName={customerName}
      />

      <MergeSitesDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        primarySite={site}
        siblingsSites={siblingsSites}
        customerName={customerName}
      />
    </>
  );
}
