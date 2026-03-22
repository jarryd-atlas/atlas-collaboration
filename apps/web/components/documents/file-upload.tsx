"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Image, File } from "lucide-react";
import { Button } from "../ui/button";
import type { EntityType } from "@repo/supabase";

interface FileUploadProps {
  entityType: EntityType;
  entityId: string;
  tenantId: string;
  /** Callback after successful upload */
  onUploaded?: () => void;
  /** Compact mode hides the drop zone text */
  compact?: boolean;
}

export function FileUpload({
  entityType,
  entityId,
  tenantId,
  onUploaded,
  compact = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  }, []);

  async function handleUpload() {
    if (!selectedFile) return;

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("entityType", entityType);
      formData.set("entityId", entityId);
      formData.set("tenantId", tenantId);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      setUploading(false);

      if (!res.ok || result.error) {
        setError(result.error ?? "Upload failed");
      } else {
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
        onUploaded?.();
      }
    } catch {
      setUploading(false);
      setError("Network error — please try again");
    }
  }

  function getFileIcon(type: string) {
    if (type.startsWith("image/")) return <Image className="h-5 w-5 text-blue-500" />;
    if (type === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
            isDragging
              ? "border-brand-green bg-brand-green/5"
              : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
          } ${compact ? "px-4 py-3" : "px-6 py-8"}`}
        >
          <div className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col items-center gap-2"}`}>
            <Upload className={`${compact ? "h-4 w-4" : "h-8 w-8"} text-gray-400`} />
            <div className={compact ? "" : "text-center"}>
              <p className={`${compact ? "text-sm" : "text-sm"} text-gray-600`}>
                {compact ? "Upload file" : "Drop a file here or click to browse"}
              </p>
              {!compact && (
                <p className="text-xs text-gray-400 mt-1">
                  PDF, Word, Excel, images, and more (max 100MB)
                </p>
              )}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            {getFileIcon(selectedFile.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
