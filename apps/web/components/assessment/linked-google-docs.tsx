"use client";

import { useState, useEffect, useCallback } from "react";
import { GoogleDocsLinker } from "../documents/google-docs-picker";
import { GoogleDocEmbed } from "../documents/google-doc-embed";
import { fetchLinkedGoogleDocs, unlinkGoogleDoc, type SiteGoogleDoc } from "../../lib/actions/google-docs";
import { Link2, ExternalLink, Unlink, Loader2 } from "lucide-react";

interface LinkedGoogleDocsProps {
  siteId: string;
}

function getDocTypeLabel(mimeType: string): string {
  if (mimeType.includes("document")) return "Doc";
  if (mimeType.includes("spreadsheet")) return "Sheet";
  if (mimeType.includes("presentation")) return "Slides";
  return "File";
}

function getDocPillColor(mimeType: string): string {
  if (mimeType.includes("document")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (mimeType.includes("spreadsheet")) return "bg-green-50 text-green-700 border-green-200";
  if (mimeType.includes("presentation")) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

export function LinkedGoogleDocs({ siteId }: LinkedGoogleDocsProps) {
  const [linkedDocs, setLinkedDocs] = useState<SiteGoogleDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [embedDoc, setEmbedDoc] = useState<SiteGoogleDoc | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const loadLinkedDocs = useCallback(async () => {
    setLoadingDocs(true);
    const docs = await fetchLinkedGoogleDocs(siteId);
    setLinkedDocs(docs);
    setLoadingDocs(false);
  }, [siteId]);

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
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Linked Google Docs</h2>
      </div>

      {loadingDocs ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {linkedDocs.map((doc) => (
            <div
              key={doc.id}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${getDocPillColor(doc.mime_type)}`}
            >
              <Link2 className="h-3 w-3" />
              <button
                onClick={() => setEmbedDoc(doc)}
                className="hover:underline"
                title="Open preview"
              >
                {doc.title}
              </button>
              <span className="opacity-60 text-[10px]">
                {getDocTypeLabel(doc.mime_type)}
              </span>
              <a
                href={doc.google_url}
                target="_blank"
                rel="noopener"
                className="opacity-40 hover:opacity-80"
                title="Open in Google"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <button
                onClick={() => handleUnlink(doc.id)}
                disabled={unlinkingId === doc.id}
                className="ml-0.5 opacity-40 hover:text-red-500 hover:opacity-100 disabled:opacity-25"
                title="Unlink"
              >
                <Unlink className="h-3 w-3" />
              </button>
            </div>
          ))}

          <GoogleDocsLinker siteId={siteId} onLinked={loadLinkedDocs} />
        </div>
      )}

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
