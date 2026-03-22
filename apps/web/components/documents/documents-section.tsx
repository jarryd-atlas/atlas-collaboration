"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { FileUpload } from "./file-upload";
import { DocumentList } from "./document-list";
import { Button } from "../ui/button";
import type { EntityType } from "@repo/supabase";

interface DocumentsSectionProps {
  entityType: EntityType;
  entityId: string;
  tenantId: string;
  title?: string;
  /** Show context column in document list */
  showContext?: boolean;
}

export function DocumentsSection({
  entityType,
  entityId,
  tenantId,
  title = "Documents",
  showContext = false,
}: DocumentsSectionProps) {
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUpload(!showUpload)}
        >
          <FileUp className="h-4 w-4" /> Upload
        </Button>
      </div>

      {showUpload && (
        <FileUpload
          entityType={entityType}
          entityId={entityId}
          tenantId={tenantId}
          onUploaded={() => {
            setRefreshKey((k) => k + 1);
            setShowUpload(false);
          }}
        />
      )}

      <DocumentList
        entityType={entityType}
        entityId={entityId}
        showContext={showContext}
        refreshKey={refreshKey}
      />
    </div>
  );
}
