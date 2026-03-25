"use client";

import { useState } from "react";
import { X, Eye, Pencil, ExternalLink } from "lucide-react";

interface GoogleDocEmbedProps {
  fileId: string;
  mimeType: string;
  title: string;
  googleUrl: string;
  onClose: () => void;
}

function getEmbedUrl(fileId: string, mimeType: string, mode: "preview" | "edit"): string {
  const suffix = mode === "edit" ? "edit" : "preview";

  if (mimeType.includes("document")) {
    return `https://docs.google.com/document/d/${fileId}/${suffix}`;
  }
  if (mimeType.includes("spreadsheet")) {
    return `https://docs.google.com/spreadsheets/d/${fileId}/${suffix}`;
  }
  if (mimeType.includes("presentation")) {
    return `https://docs.google.com/presentation/d/${fileId}/${suffix}`;
  }
  // Fallback: try document embed
  return `https://docs.google.com/document/d/${fileId}/${suffix}`;
}

function getTypeLabel(mimeType: string): string {
  if (mimeType.includes("document")) return "Google Doc";
  if (mimeType.includes("spreadsheet")) return "Google Sheet";
  if (mimeType.includes("presentation")) return "Google Slides";
  return "Google Doc";
}

export function GoogleDocEmbed({ fileId, mimeType, title, googleUrl, onClose }: GoogleDocEmbedProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const embedUrl = getEmbedUrl(fileId, mimeType, mode);
  const typeLabel = getTypeLabel(mimeType);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0">
          <GoogleDocIcon mimeType={mimeType} />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">{title}</h3>
            <span className="text-xs text-gray-400">{typeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View/Edit toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => setMode("preview")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === "preview"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Eye className="h-3 w-3" /> View
            </button>
            <button
              onClick={() => setMode("edit")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                mode === "edit"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>

          {/* Open in Google */}
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Open in Google"
          >
            <ExternalLink className="h-4 w-4" />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Embedded document */}
      <div className="flex-1 bg-white">
        <iframe
          key={`${fileId}-${mode}`}
          src={embedUrl}
          className="w-full h-full border-0"
          title={title}
          allow="clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}

function GoogleDocIcon({ mimeType }: { mimeType: string }) {
  const size = "h-5 w-5";
  if (mimeType.includes("document")) {
    return (
      <svg className={size} viewBox="0 0 24 24">
        <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#4285F4" d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0-6h5v1.5H8z" />
      </svg>
    );
  }
  if (mimeType.includes("spreadsheet")) {
    return (
      <svg className={size} viewBox="0 0 24 24">
        <path fill="#0F9D58" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#0F9D58" d="M8 12h3v2H8zm0 3h3v2H8zm4-3h4v2h-4zm0 3h4v2h-4z" />
      </svg>
    );
  }
  if (mimeType.includes("presentation")) {
    return (
      <svg className={size} viewBox="0 0 24 24">
        <path fill="#F4B400" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path fill="#F4B400" d="M8 11h8v6H8z" />
      </svg>
    );
  }
  return null;
}
