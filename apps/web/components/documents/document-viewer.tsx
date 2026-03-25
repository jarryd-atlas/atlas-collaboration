"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, ChevronLeft, ChevronRight, Download, ExternalLink,
  FileText, FileSpreadsheet, File, Presentation,
} from "lucide-react";

interface ViewerDocument {
  id: string;
  file_name: string;
  mime_type: string | null;
  url: string | null;
}

interface DocumentViewerProps {
  documents: ViewerDocument[];
  initialIndex: number;
  onClose: () => void;
}

export function DocumentViewer({ documents, initialIndex, onClose }: DocumentViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const doc = documents[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, documents.length - 1));
  }, [documents.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll while viewer is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!doc) return null;

  const canGoNext = currentIndex < documents.length - 1;
  const canGoPrev = currentIndex > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-gray-700/50">
        <div className="flex items-center gap-3 min-w-0">
          {getFileIconForViewer(doc.mime_type)}
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">{doc.file_name}</h3>
            <span className="text-xs text-gray-400">
              {currentIndex + 1} of {documents.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {doc.url && (
            <>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={doc.url}
                download={doc.file_name}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Previous button */}
        {canGoPrev && (
          <button
            onClick={goPrev}
            className="absolute left-3 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
            title="Previous (←)"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Document content */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <DocumentContent doc={doc} />
        </div>

        {/* Next button */}
        {canGoNext && (
          <button
            onClick={goNext}
            className="absolute right-3 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors"
            title="Next (→)"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom bar with thumbnail indicators */}
      {documents.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 bg-gray-900/90 border-t border-gray-700/50">
          {documents.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? "bg-white" : "bg-gray-600 hover:bg-gray-400"
              }`}
              title={documents[i]?.file_name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentContent({ doc }: { doc: ViewerDocument }) {
  if (!doc.url) {
    return (
      <div className="text-center text-gray-400">
        <File className="h-16 w-16 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No preview available</p>
        <p className="text-xs mt-1">This file cannot be previewed.</p>
      </div>
    );
  }

  const mime = doc.mime_type ?? "";

  // Images
  if (mime.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={doc.url}
        alt={doc.file_name}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    );
  }

  // PDFs
  if (mime === "application/pdf") {
    return (
      <iframe
        src={doc.url}
        className="w-full h-full rounded-lg bg-white"
        title={doc.file_name}
      />
    );
  }

  // Office documents (xlsx, docx, pptx) — use Office Online viewer
  if (
    mime.includes("spreadsheet") || mime.includes("excel") ||
    mime.includes("word") || mime.includes("document") ||
    mime.includes("presentation") || mime.includes("powerpoint") ||
    doc.file_name.endsWith(".csv")
  ) {
    const encodedUrl = encodeURIComponent(doc.url);
    return (
      <iframe
        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`}
        className="w-full h-full rounded-lg bg-white"
        title={doc.file_name}
      />
    );
  }

  // Text files
  if (mime.startsWith("text/")) {
    return (
      <iframe
        src={doc.url}
        className="w-full h-full rounded-lg bg-white"
        title={doc.file_name}
      />
    );
  }

  // Fallback — can't preview
  return (
    <div className="text-center text-gray-400">
      <File className="h-16 w-16 mx-auto mb-3 opacity-50" />
      <p className="text-sm">Preview not available for this file type</p>
      <p className="text-xs mt-1 text-gray-500">{doc.file_name}</p>
      {doc.url && (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
        >
          <Download className="h-4 w-4" /> Download to view
        </a>
      )}
    </div>
  );
}

function getFileIconForViewer(mimeType: string | null) {
  const cls = "h-5 w-5 text-gray-400";
  if (!mimeType) return <File className={cls} />;
  if (mimeType.startsWith("image/")) return <File className="h-5 w-5 text-blue-400" />;
  if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-400" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-5 w-5 text-green-400" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <Presentation className="h-5 w-5 text-orange-400" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <FileText className="h-5 w-5 text-blue-400" />;
  return <File className={cls} />;
}
