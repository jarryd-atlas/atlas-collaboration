"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteDocumentsManager } from "../documents";
import { GoogleDocsPicker } from "../documents/google-docs-picker";
import { GoogleDocEmbed } from "../documents/google-doc-embed";
import { fetchLinkedGoogleDocs, unlinkGoogleDoc, type SiteGoogleDoc } from "../../lib/actions/google-docs";
import { ExternalLink, Unlink, FileText } from "lucide-react";
import type { EntityType } from "@repo/supabase";

interface DocumentsTabProps {
  site: { id: string; tenant_id: string; name: string };
  canAnalyze?: boolean;
  assessmentId?: string;
}

function getGoogleDocTypeLabel(mimeType: string): string {
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.includes("spreadsheet")) return "Sheet";
  if (mimeType.includes("presentation")) return "Slides";
  return "File";
}

function getGoogleDocTypeBadgeColor(mimeType: string): string {
  if (mimeType.includes("document")) return "bg-blue-50 text-blue-700";
  if (mimeType.includes("spreadsheet")) return "bg-green-50 text-green-700";
  if (mimeType.includes("presentation")) return "bg-yellow-50 text-yellow-700";
  return "bg-gray-50 text-gray-700";
}

export function DocumentsTab({ site, canAnalyze = false }: DocumentsTabProps) {
  const [linkedDocs, setLinkedDocs] = useState<SiteGoogleDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [embedDoc, setEmbedDoc] = useState<SiteGoogleDoc | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const loadLinkedDocs = useCallback(async () => {
    setLoadingDocs(true);
    const docs = await fetchLinkedGoogleDocs(site.id);
    setLinkedDocs(docs);
    setLoadingDocs(false);
  }, [site.id]);

  useEffect(() => {
    loadLinkedDocs();
  }, [loadLinkedDocs]);

  async function handleUnlink(linkId: string) {
    setUnlinkingId(linkId);
    const result = await unlinkGoogleDoc(linkId);
    if ("success" in result) {
      setLinkedDocs((prev) => prev.filter((d) => d.id !== linkId));
    }
    setUnlinkingId(null);
  }

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

      {/* Linked Google Docs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Linked Google Docs
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Search and link Google Docs, Sheets, or Slides to this site
            </p>
          </div>
          <GoogleDocsPicker siteId={site.id} onLinked={loadLinkedDocs} />
        </div>

        {loadingDocs ? (
          <div className="text-center py-8 text-sm text-gray-400">Loading linked documents...</div>
        ) : linkedDocs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-card px-6 py-8 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No Google Docs linked yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Link Google Docs, Sheets, or Slides to keep project files organized
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
            {linkedDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors group"
              >
                {/* Icon */}
                <GoogleDocIcon mimeType={doc.mime_type} />

                {/* Title and type */}
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setEmbedDoc(doc)}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block text-left w-full transition-colors"
                  >
                    {doc.title}
                  </button>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${getGoogleDocTypeBadgeColor(doc.mime_type)}`}>
                    {getGoogleDocTypeLabel(doc.mime_type)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setEmbedDoc(doc)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    title="Open in app"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnlink(doc.id)}
                    disabled={unlinkingId === doc.id}
                    className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Unlink"
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Doc Embed Modal */}
      {embedDoc && (
        <GoogleDocEmbed
          fileId={embedDoc.google_file_id}
          mimeType={embedDoc.mime_type}
          title={embedDoc.title}
          googleUrl={embedDoc.google_url}
          onClose={() => setEmbedDoc(null)}
        />
      )}
    </div>
  );
}

function GoogleDocIcon({ mimeType }: { mimeType: string }) {
  const cls = "h-5 w-5 flex-shrink-0";
  if (mimeType.includes("document")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#4285F4" d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0-6h5v1.5H8z" />
      </svg>
    );
  }
  if (mimeType.includes("spreadsheet")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#0F9D58" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#0F9D58" d="M8 12h3v2H8zm0 3h3v2H8zm4-3h4v2h-4zm0 3h4v2h-4z" />
      </svg>
    );
  }
  if (mimeType.includes("presentation")) {
    return (
      <svg className={cls} viewBox="0 0 24 24">
        <path fill="#F4B400" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#F4B400" d="M8 11h8v6H8z" />
      </svg>
    );
  }
  return <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />;
}
