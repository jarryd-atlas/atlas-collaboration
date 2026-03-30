"use client";

import { useState, useEffect, useCallback } from "react";
import { GoogleDocsLinker } from "../documents/google-docs-picker";
import { GoogleDocEmbed } from "../documents/google-doc-embed";
import { fetchLinkedGoogleDocs, unlinkGoogleDoc, type SiteGoogleDoc } from "../../lib/actions/google-docs";
import { Link2, ExternalLink, Unlink, FileText, Loader2 } from "lucide-react";

interface EvaTabProps {
  site: { id: string; tenant_id: string; name: string };
  assessmentId?: string;
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

export function EvaTab({ site }: EvaTabProps) {
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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Linked Google Docs</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Search and link Google Docs, Sheets, or Slides to this site
        </p>
      </div>

      {loadingDocs ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-2">
          {/* Linked doc pills */}
          {linkedDocs.map((doc) => (
            <div key={doc.id} className="inline-flex items-center gap-1.5 mr-2">
              <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${getDocPillColor(doc.mime_type)}`}>
                <DocPillIcon mimeType={doc.mime_type} />
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
            </div>
          ))}

          {linkedDocs.length === 0 && (
            <p className="text-xs text-gray-400">No documents linked yet</p>
          )}

          {/* Link new doc — inline search */}
          <div className="pt-1">
            <GoogleDocsLinker siteId={site.id} onLinked={loadLinkedDocs} />
          </div>
        </div>
      )}

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

function DocPillIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.includes("document")) return <Link2 className="h-3 w-3" />;
  if (mimeType.includes("spreadsheet")) return <Link2 className="h-3 w-3" />;
  if (mimeType.includes("presentation")) return <Link2 className="h-3 w-3" />;
  return <FileText className="h-3 w-3" />;
}
