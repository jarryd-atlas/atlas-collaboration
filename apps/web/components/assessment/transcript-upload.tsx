"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";

interface TranscriptUploadProps {
  siteId: string;
  tenantId: string;
  assessmentId?: string;
  isLocked: boolean;
}

type UploadState = "idle" | "uploading" | "analyzing" | "complete" | "error";

interface UploadResult {
  summary: string;
  sectionsApplied: string[];
  confidence: number;
}

const SECTION_LABELS: Record<string, string> = {
  equipment: "Equipment",
  energyData: "Energy Data",
  touSchedule: "TOU Schedule",
  rateStructure: "Rate Structure",
  operationalParams: "Operational Params",
  operations: "Operations",
  labor: "Labor",
  siteContacts: "Site Contacts",
};

export function TranscriptUpload({
  siteId,
  tenantId,
  assessmentId,
  isLocked,
}: TranscriptUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      if (isLocked) return;
      setError("");
      setResult(null);
      setFileName(file.name);

      try {
        // Step 1: Upload file
        setState("uploading");
        setStatusMessage("Uploading transcript...");

        const formData = new FormData();
        formData.set("file", file);
        formData.set("entityType", "site");
        formData.set("entityId", siteId);
        formData.set("tenantId", tenantId);
        formData.set("category", "interview-transcript");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadRes.json();

        if (!uploadRes.ok || uploadResult.error) {
          throw new Error(uploadResult.error ?? "Upload failed");
        }

        const attachmentId = uploadResult.id;

        // Step 2: Process content client-side
        setState("analyzing");
        const mime = file.type || "text/plain";

        let content: string | undefined;
        let pageImages: string[] | undefined;
        let processedMimeType: string | undefined;

        if (mime === "application/pdf") {
          setStatusMessage("Rendering PDF pages...");
          const buffer = await file.arrayBuffer();
          pageImages = await renderPdfPages(buffer, (current, total) => {
            setStatusMessage(`Rendering page ${current} of ${total}...`);
          });
          processedMimeType = "image/jpeg";
        } else {
          // Text files (.txt, .md, .doc, etc.)
          setStatusMessage("Reading transcript...");
          content = await file.text();
          processedMimeType = mime || "text/plain";
        }

        // Step 3: Analyze with AI
        setStatusMessage("Extracting baseline data with AI...");
        const analyzeRes = await fetch("/api/ai/analyze-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attachmentId,
            siteId,
            content,
            pageImages,
            mimeType: processedMimeType,
            fileName: file.name,
            category: "interview-transcript",
          }),
        });
        const analyzeResult = await analyzeRes.json();

        if (!analyzeRes.ok || analyzeResult.error) {
          throw new Error(analyzeResult.error ?? "Analysis failed");
        }

        // Success
        setState("complete");
        setResult({
          summary: analyzeResult.summary,
          sectionsApplied: analyzeResult.sectionsApplied || [],
          confidence: analyzeResult.confidence,
        });
        setStatusMessage("");
        router.refresh();
      } catch (err) {
        setState("error");
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
        setStatusMessage("");
      }
    },
    [siteId, tenantId, isLocked, router],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isLocked) setIsDragging(true);
    },
    [isLocked],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isLocked) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [isLocked, handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError("");
    setResult(null);
    setFileName("");
    setStatusMessage("");
  }, []);

  if (isLocked) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 text-center">
        <p className="text-sm text-gray-400">
          Assessment is locked. Transcript upload is disabled.
        </p>
      </div>
    );
  }

  // Show result after successful analysis
  if (state === "complete" && result) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-green-800">
                Transcript analyzed successfully
              </p>
              {fileName && (
                <p className="text-xs text-green-600 mt-0.5">{fileName}</p>
              )}
              <p className="text-sm text-green-700 mt-2">{result.summary}</p>

              {result.sectionsApplied.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.sectionsApplied.map((section) => (
                    <span
                      key={section}
                      className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                    >
                      {SECTION_LABELS[section] || section}
                    </span>
                  ))}
                </div>
              )}

              {result.confidence > 0 && (
                <p className="text-xs text-green-500 mt-2">
                  Confidence: {Math.round(result.confidence * 100)}%
                </p>
              )}
            </div>
            <button
              onClick={reset}
              className="shrink-0 rounded-md p-1 text-green-400 hover:text-green-600 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload another transcript
        </button>
      </div>
    );
  }

  // Show error state
  if (state === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-800">
                Analysis failed
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={reset}
              className="shrink-0 rounded-md p-1 text-red-400 hover:text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    );
  }

  // Show progress during upload/analysis
  if (state === "uploading" || state === "analyzing") {
    return (
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            {state === "analyzing" && (
              <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-indigo-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-indigo-700">
              {statusMessage || "Processing..."}
            </p>
            {fileName && (
              <p className="text-xs text-indigo-500 mt-1">{fileName}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: idle upload zone
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragging
          ? "border-indigo-400 bg-indigo-50/50"
          : "border-gray-200 bg-gray-50/30 hover:border-gray-300"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,.md,.doc,.docx,.rtf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-50">
          <FileText className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <p className="text-sm text-gray-600">
            Drop an interview transcript here, or{" "}
            <button
              onClick={() => inputRef.current?.click()}
              className="font-medium text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            >
              browse files
            </button>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Supports TXT, PDF, DOC, DOCX, RTF, and MD files
          </p>
        </div>
        <p className="text-xs text-gray-400">
          AI will extract equipment, operations, labor, and contact data to
          populate the baseline form
        </p>
      </div>
    </div>
  );
}

/** Render PDF pages as base64 JPEG images for Claude vision analysis */
async function renderPdfPages(
  buffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const maxPages = Math.min(pdf.numPages, 30);
  const images: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(i, maxPages);
    const page = await pdf.getPage(i);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height);
    const scale = Math.min(1568 / maxDim, 2.0);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    images.push(dataUrl.split(",")[1]!);
    canvas.width = 0;
    canvas.height = 0;
  }

  return images;
}
