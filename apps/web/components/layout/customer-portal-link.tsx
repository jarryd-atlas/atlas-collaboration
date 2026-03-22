"use client";

import { useSearchParams } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";

interface CustomerPortalLinkProps {
  /** The current internal path, e.g. /customers/americold/sites/denver */
  currentPath: string;
  /** Customer slug for constructing the portal URL */
  customerSlug: string;
  className?: string;
}

/**
 * Link that toggles between internal CK view and customer portal preview.
 * Adds ?preview=customer to show the customer's perspective.
 */
export function CustomerPortalLink({ currentPath, customerSlug, className }: CustomerPortalLinkProps) {
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "customer";

  if (isPreview) {
    // Show "Back to Internal View" link
    return (
      <a
        href={currentPath}
        className={`inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 transition-colors ${className ?? ""}`}
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Internal View
      </a>
    );
  }

  return (
    <a
      href={`${currentPath}?preview=customer`}
      title="Preview what the company sees at this page"
      className={`inline-flex items-center gap-1.5 rounded-md border border-brand-green/30 bg-brand-green/5 px-2.5 py-1 text-xs font-medium text-brand-dark hover:bg-brand-green/10 transition-colors ${className ?? ""}`}
    >
      <ExternalLink className="h-3 w-3" />
      Company Portal View
    </a>
  );
}
