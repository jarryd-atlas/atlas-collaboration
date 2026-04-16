"use client";

import { useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toggleOutputSharing } from "../../lib/actions/discovery";

interface ShareSectionToggleProps {
  siteId: string;
  tenantId: string;
  sectionKey: string;
  isShared: boolean;
}

export function ShareSectionToggle({
  siteId,
  tenantId,
  sectionKey,
  isShared,
}: ShareSectionToggleProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleOutputSharing(siteId, tenantId, sectionKey, !isShared);
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
        isPending ? "opacity-50" : ""
      } ${
        isShared
          ? "bg-purple-50 text-purple-700 hover:bg-purple-100"
          : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      }`}
      title={isShared ? "Visible to customer — click to hide" : "Hidden from customer — click to share"}
    >
      {isShared ? (
        <>
          <Eye className="h-3 w-3" />
          <span>Shared</span>
        </>
      ) : (
        <>
          <EyeOff className="h-3 w-3" />
          <span>Hidden</span>
        </>
      )}
    </button>
  );
}
