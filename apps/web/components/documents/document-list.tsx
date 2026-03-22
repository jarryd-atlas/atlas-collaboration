"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image,
  File,
  Download,
  Trash2,
  MoreVertical,
  FileSpreadsheet,
  Presentation,
} from "lucide-react";
import { Button } from "../ui/button";
import { fetchAttachments, deleteAttachment } from "../../lib/actions";
import type { EntityType } from "@repo/supabase";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  type: string;
  created_at: string;
  uploaded_by: string;
  url: string | null;
  uploader_name: string;
  context?: string;
}

interface DocumentListProps {
  entityType: EntityType;
  entityId: string;
  /** Show entity context column (for customer-wide views) */
  showContext?: boolean;
  /** Refresh key - increment to trigger refetch */
  refreshKey?: number;
}

export function DocumentList({
  entityType,
  entityId,
  showContext = false,
  refreshKey = 0,
}: DocumentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAttachments(entityType, entityId);
    setAttachments((result.attachments ?? []) as Attachment[]);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setDeletingId(id);
    const result = await deleteAttachment(id);
    setDeletingId(null);
    setOpenMenuId(null);
    if (!("error" in result)) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    }
  }

  function getFileIcon(mimeType: string | null, fileName: string) {
    if (!mimeType) return <File className="h-5 w-5 text-gray-400" />;
    if (mimeType.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
    if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || fileName.endsWith(".csv"))
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
      return <Presentation className="h-5 w-5 text-orange-500" />;
    if (mimeType.includes("word") || mimeType.includes("document"))
      return <FileText className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5 text-gray-400" />;
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-gray-100 bg-gray-50 h-14"
          />
        ))}
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors group"
        >
          {getFileIcon(att.mime_type, att.file_name)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {att.file_name}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {showContext && att.context && (
                <>
                  <span className="text-gray-500">{att.context}</span>
                  <span>&middot;</span>
                </>
              )}
              <span>{att.uploader_name}</span>
              <span>&middot;</span>
              <span>{formatDate(att.created_at)}</span>
              {att.file_size && (
                <>
                  <span>&middot;</span>
                  <span>{formatFileSize(att.file_size)}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {att.url && (
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.file_name}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => handleDelete(att.id)}
              disabled={deletingId === att.id}
              className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
