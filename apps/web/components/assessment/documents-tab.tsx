"use client";

import { SiteDocumentsManager } from "../documents";
import type { EntityType } from "@repo/supabase";

interface DocumentsTabProps {
  site: { id: string; tenant_id: string; name: string };
  canAnalyze?: boolean;
  assessmentId?: string;
}

export function DocumentsTab({ site, canAnalyze = false }: DocumentsTabProps) {
  return (
    <div className="space-y-8">
      {/* Uploaded Documents */}
      <SiteDocumentsManager
        entityType={"site" as EntityType}
        entityId={site.id}
        tenantId={site.tenant_id}
        canAnalyze={canAnalyze}
        siteId={site.id}
      />
    </div>
  );
}
