"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image,
  File,
  FileSpreadsheet,
  Presentation,
  Upload,
  Download,
  Trash2,
  X,
  Check,
  AlertCircle,
  BarChart3,
  Receipt,
  Camera,
  Gauge,
  Thermometer,
  ClipboardList,
  FileDigit,
  Zap,
  ImagePlus,
  ChevronDown,
  ExternalLink,
  Eye,
  Pencil,
  History,
  UploadCloud,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";
import { fetchAttachments, deleteAttachment, updateAttachmentCategory, updateAttachmentFileName, updateAttachmentNote, fetchVersionHistory } from "../../lib/actions";
import type { EntityType } from "@repo/supabase";

/** Default document categories for site pages — matches CK standard folder list */
const SITE_CATEGORIES = [
  { key: "interval-data", label: "Interval Data", icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "utility-bills", label: "Utility Bills", icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "compressor-photos", label: "Compressor Micro Panel Photos", icon: Camera, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "refrigeration-photos", label: "Refrigeration Control Panel Photos", icon: Thermometer, color: "text-red-600", bg: "bg-red-50" },
  { key: "round-sheets", label: "Round Sheets / System Logs", icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
  { key: "p-and-id", label: "P&ID", icon: FileDigit, color: "text-cyan-600", bg: "bg-cyan-50" },
  { key: "mass-balance", label: "Mass Balance Worksheet", icon: Gauge, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "electrical-drawings", label: "Electrical Drawings", icon: Zap, color: "text-yellow-600", bg: "bg-yellow-50" },
  { key: "additional-photos", label: "Additional Site Photos", icon: ImagePlus, color: "text-teal-600", bg: "bg-teal-50" },
] as const;

type CategoryKey = (typeof SITE_CATEGORIES)[number]["key"];

const CATEGORY_MAP = Object.fromEntries(SITE_CATEGORIES.map((c) => [c.key, c]));

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
  category: string | null;
  note: string | null;
}

interface SiteDocumentsManagerProps {
  entityType: EntityType;
  entityId: string;
  tenantId: string;
  canAnalyze?: boolean;
  siteId?: string;
  onExtractionComplete?: (extractionId: string, extraction: any) => void;
}

export function SiteDocumentsManager({
  entityType,
  entityId,
  tenantId,
  canAnalyze = false,
  siteId,
  onExtractionComplete,
}: SiteDocumentsManagerProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("interval-data");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<CategoryKey | "all">("all");
  const [analyzeOnUpload, setAnalyzeOnUpload] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAttachments(entityType, entityId);
    setAttachments((result.attachments ?? []) as Attachment[]);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCategoryPicker(false);
      }
    }
    if (showCategoryPicker) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showCategoryPicker]);

  // Filtered docs
  const displayedAttachments =
    filterCategory === "all"
      ? attachments
      : attachments.filter((a) => a.category === filterCategory);

  // Group by category for display
  const groupedAttachments = SITE_CATEGORIES.map((cat) => ({
    ...cat,
    docs: attachments.filter((a) => a.category === cat.key),
  })).filter((g) => g.docs.length > 0);

  // Upload handler
  async function handleUpload(files: FileList | File[]) {
    if (files.length === 0) return;

    setUploadError("");
    setUploadSuccess("");
    setUploading(true);

    let successCount = 0;
    let lastError = "";

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("entityType", entityType);
        formData.set("entityId", entityId);
        formData.set("tenantId", tenantId);
        formData.set("category", selectedCategory);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const result = await res.json();
        if (!res.ok || result.error) {
          lastError = `${file.name}: ${result.error ?? "Upload failed"}`;
        } else {
          successCount++;
        }
      } catch {
        lastError = `${file.name}: Network error`;
      }
    }

    setUploading(false);

    if (lastError) {
      setUploadError(lastError);
    }
    if (successCount > 0) {
      setUploadSuccess(`${successCount} file${successCount > 1 ? "s" : ""} uploaded to ${CATEGORY_MAP[selectedCategory]?.label}`);
      setTimeout(() => setUploadSuccess(""), 4000);
      await load();
      router.refresh();

      // Auto-analyze if toggle is on and we have siteId
      if (analyzeOnUpload && canAnalyze && siteId) {
        // Analyze the most recently uploaded files
        const recentUploads = attachments.slice(-successCount);
        for (const att of recentUploads) {
          handleAnalyze(att.id);
        }
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setDeletingId(id);
    const result = await deleteAttachment(id);
    setDeletingId(null);
    if (!("error" in result)) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    }
  }

  async function handleCategoryChange(attachmentId: string, newCategory: string) {
    const result = await updateAttachmentCategory(attachmentId, newCategory);
    if ("error" in result && result.error) {
      setUploadError(result.error);
    } else {
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, category: newCategory } : a)),
      );
      router.refresh();
    }
  }

  async function handleFileNameChange(attachmentId: string, newName: string) {
    const result = await updateAttachmentFileName(attachmentId, newName);
    if ("error" in result && result.error) {
      setUploadError(result.error);
    } else {
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, file_name: newName.trim() } : a)),
      );
      router.refresh();
    }
  }

  async function handleAnalyze(attachmentId: string) {
    if (!siteId) return;
    setAnalyzingId(attachmentId);
    try {
      const res = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId, siteId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setUploadError(result.error ?? "Analysis failed");
      } else {
        // Auto-applied — update local state with AI summary
        const summary = result.summary || `Applied: ${(result.sectionsApplied || []).join(", ")}`;
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? { ...a, ai_summary: summary }
              : a,
          ),
        );
        setUploadSuccess(`✨ ${summary}`);
        setTimeout(() => setUploadSuccess(""), 8000);
        router.refresh();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to connect to analysis service. Please try again.");
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleNoteChange(attachmentId: string, note: string) {
    const result = await updateAttachmentNote(attachmentId, note);
    if ("error" in result && result.error) {
      setUploadError(result.error);
    } else {
      setAttachments((prev) =>
        prev.map((a) => (a.id === attachmentId ? { ...a, note: note.trim() || null } : a)),
      );
      router.refresh();
    }
  }

  function handleUploadVersion(attachmentId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploading(true);
      setUploadError("");

      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("originalAttachmentId", attachmentId);

        const res = await fetch("/api/upload/version", { method: "POST", body: formData });
        const result = await res.json();

        if (!res.ok || result.error) {
          setUploadError(result.error ?? "Version upload failed");
        } else {
          setUploadSuccess(`New version (v${result.versionNumber}) uploaded successfully`);
          setTimeout(() => setUploadSuccess(""), 4000);
          await load();
          router.refresh();
        }
      } catch {
        setUploadError("Network error during version upload");
      }

      setUploading(false);
    };
    input.click();
  }

  const selectedCategoryDef = CATEGORY_MAP[selectedCategory];
  const SelectedIcon = selectedCategoryDef?.icon ?? File;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <div className="animate-pulse space-y-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 h-20" />
          <div className="rounded-xl border border-gray-100 bg-gray-50 h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <span className="text-xs text-gray-400">
          {attachments.length} file{attachments.length !== 1 ? "s" : ""} uploaded
        </span>
      </div>

      {/* Upload zone — always visible, one step */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed transition-all ${
          isDragging
            ? "border-brand-green bg-brand-green/5"
            : "border-gray-200 bg-gray-50/50"
        } p-4`}
      >
        <div className="flex items-center gap-3">
          {/* Category picker */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-w-0`}
            >
              <SelectedIcon className={`h-4 w-4 shrink-0 ${selectedCategoryDef?.color ?? ""}`} />
              <span className="truncate max-w-[180px]">{selectedCategoryDef?.label}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>

            {showCategoryPicker && (
              <div className="absolute top-full left-0 mt-1 z-20 w-72 bg-white rounded-xl border border-gray-200 shadow-lg py-1 max-h-80 overflow-y-auto">
                {SITE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const count = attachments.filter((a) => a.category === cat.key).length;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => {
                        setSelectedCategory(cat.key);
                        setShowCategoryPicker(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                        selectedCategory === cat.key ? "bg-gray-50 font-medium" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${cat.color}`} />
                      <span className="flex-1 truncate">{cat.label}</span>
                      {count > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload button + drop zone text */}
          <div className="flex-1 flex items-center justify-center gap-2">
            {uploading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="h-4 w-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                Uploading...
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Drop files here or
              </p>
            )}
          </div>

          {/* Browse button */}
          <button
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0"
          >
            <Upload className="h-4 w-4" />
            Browse
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip"
          />
        </div>
      </div>

      {/* AI Analyze on Upload toggle — only for CK users */}
      {canAnalyze && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={analyzeOnUpload}
            onChange={(e) => setAnalyzeOnUpload(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            Analyze with AI to fill baseline data on upload
          </span>
        </label>
      )}

      {/* Status messages */}
      {uploadError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError("")} className="p-0.5 hover:bg-red-100 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-700">
          <Check className="h-4 w-4 shrink-0" />
          {uploadSuccess}
        </div>
      )}

      {/* Filter chips */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCategory("all")}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filterCategory === "all"
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            All
            <span className={filterCategory === "all" ? "text-gray-400" : "text-gray-300"}>
              {attachments.length}
            </span>
          </button>
          {SITE_CATEGORIES.map((cat) => {
            const count = attachments.filter((a) => a.category === cat.key).length;
            if (count === 0) return null;
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => setFilterCategory(cat.key)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterCategory === cat.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
                <span className={filterCategory === cat.key ? "text-gray-400" : "text-gray-300"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Documents list — flat, all visible */}
      {attachments.length === 0 ? (
        <div className="text-center py-8">
          <Upload className="h-10 w-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No documents uploaded yet.</p>
          <p className="text-xs text-gray-300 mt-1">Select a category above and upload files to get started.</p>
        </div>
      ) : filterCategory === "all" ? (
        /* Grouped view */
        <div className="space-y-4">
          {groupedAttachments.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1 rounded ${group.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${group.color}`} />
                  </div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group.label}
                  </h3>
                  <span className="text-xs text-gray-300">{group.docs.length}</span>
                </div>
                <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
                  {group.docs.map((att) => (
                    <DocRow
                      key={att.id}
                      att={att}
                      deletingId={deletingId}
                      onDelete={handleDelete}
                      onCategoryChange={handleCategoryChange}
                      onUploadVersion={handleUploadVersion}
                      onFileNameChange={handleFileNameChange}
                      onNoteChange={handleNoteChange}
                      canAnalyze={canAnalyze}
                      analyzingId={analyzingId}
                      onAnalyze={handleAnalyze}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Filtered view */
        <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 bg-white">
          {displayedAttachments.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">
              No documents in this category.
            </div>
          ) : (
            displayedAttachments.map((att) => (
              <DocRow
                key={att.id}
                att={att}
                deletingId={deletingId}
                onDelete={handleDelete}
                onCategoryChange={handleCategoryChange}
                onUploadVersion={handleUploadVersion}
                onFileNameChange={handleFileNameChange}
                onNoteChange={handleNoteChange}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Single document row with inline name editing, notes, category edit, version upload, quick-view, download, and delete */
function DocRow({
  att,
  deletingId,
  onDelete,
  onCategoryChange,
  onUploadVersion,
  onFileNameChange,
  onNoteChange,
  canAnalyze = false,
  analyzingId = null,
  onAnalyze,
}: {
  att: Attachment;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onCategoryChange: (id: string, newCategory: string) => void;
  onUploadVersion: (id: string) => void;
  onFileNameChange: (id: string, newName: string) => void;
  onNoteChange: (id: string, note: string) => void;
  canAnalyze?: boolean;
  analyzingId?: string | null;
  onAnalyze?: (id: string) => void;
}) {
  const [editingCategory, setEditingCategory] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(att.file_name);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(att.note ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const isPreviewable =
    att.mime_type?.startsWith("image/") ||
    att.mime_type === "application/pdf";

  // Close category picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target as Node)) {
        setEditingCategory(false);
      }
    }
    if (editingCategory) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [editingCategory]);

  // Auto-focus name input when editing starts
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      // Select the name part without extension
      const dotIdx = nameValue.lastIndexOf(".");
      nameInputRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : nameValue.length);
    }
  }, [editingName]);

  // Auto-focus note input when editing starts
  useEffect(() => {
    if (editingNote && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [editingNote]);

  async function handleShowVersions() {
    if (showVersions) {
      setShowVersions(false);
      return;
    }
    setLoadingVersions(true);
    const result = await fetchVersionHistory(att.id);
    setVersions(result.versions);
    setLoadingVersions(false);
    setShowVersions(true);
  }

  async function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === att.file_name) {
      setNameValue(att.file_name);
      setEditingName(false);
      return;
    }
    setSavingName(true);
    await onFileNameChange(att.id, trimmed);
    setSavingName(false);
    setEditingName(false);
  }

  async function saveNote() {
    const trimmed = noteValue.trim();
    if (trimmed === (att.note ?? "")) {
      setEditingNote(false);
      return;
    }
    setSavingNote(true);
    await onNoteChange(att.id, trimmed);
    setSavingNote(false);
    setEditingNote(false);
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveName();
    } else if (e.key === "Escape") {
      setNameValue(att.file_name);
      setEditingName(false);
    }
  }

  function handleNoteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveNote();
    } else if (e.key === "Escape") {
      setNoteValue(att.note ?? "");
      setEditingNote(false);
    }
  }

  const currentCat = att.category ? CATEGORY_MAP[att.category as CategoryKey] : null;

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors group">
        {getFileIcon(att.mime_type, att.file_name)}
        <div className="flex-1 min-w-0">
          {/* Inline editable file name */}
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={saveName}
                disabled={savingName}
                className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-md px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 disabled:opacity-50"
              />
              {savingName && (
                <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameValue(att.file_name);
                setEditingName(true);
              }}
              className="text-sm font-medium text-gray-900 hover:text-brand-dark truncate block text-left w-full cursor-text"
              title="Click to rename"
            >
              {att.file_name}
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
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
          {/* AI summary badge */}
          {(att as any).ai_summary && (
            <div className="mt-1 flex items-center gap-1 text-xs text-purple-600">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{(att as any).ai_summary}</span>
            </div>
          )}
          {/* Note display (when not editing) */}
          {att.note && !editingNote && (
            <button
              type="button"
              onClick={() => {
                setNoteValue(att.note ?? "");
                setEditingNote(true);
              }}
              className="mt-1 text-xs text-gray-500 italic text-left cursor-text hover:text-gray-700 transition-colors block w-full truncate"
              title="Click to edit note"
            >
              {att.note}
            </button>
          )}
          {/* Note editor */}
          {editingNote && (
            <div className="mt-1.5">
              <textarea
                ref={noteInputRef}
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                onBlur={saveNote}
                disabled={savingNote}
                placeholder="Add a note for context..."
                rows={2}
                className="w-full text-xs text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50 disabled:opacity-50"
              />
              <p className="text-[10px] text-gray-300 mt-0.5">Enter to save &middot; Esc to cancel</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Add/edit note */}
          <button
            type="button"
            onClick={() => {
              setNoteValue(att.note ?? "");
              setEditingNote(!editingNote);
            }}
            className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors ${
              att.note ? "text-brand-dark hover:text-brand-dark/80" : "text-gray-400 hover:text-gray-600"
            }`}
            title={att.note ? "Edit note" : "Add note"}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          {/* Analyze with AI */}
          {canAnalyze && onAnalyze && (
            <button
              type="button"
              onClick={() => onAnalyze(att.id)}
              disabled={analyzingId === att.id}
              className={`p-1.5 rounded-md hover:bg-purple-50 transition-colors ${
                analyzingId === att.id
                  ? "text-purple-500 animate-pulse"
                  : "text-gray-400 hover:text-purple-600"
              }`}
              title="Analyze with AI to fill baseline data"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          {/* Change category */}
          <div className="relative" ref={categoryPickerRef}>
            <button
              type="button"
              onClick={() => setEditingCategory(!editingCategory)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Change category"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {editingCategory && (
              <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white rounded-xl border border-gray-200 shadow-lg py-1 max-h-60 overflow-y-auto">
                <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase">Move to category</p>
                {SITE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = att.category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => {
                        onCategoryChange(att.id, cat.key);
                        setEditingCategory(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 transition-colors ${
                        isSelected ? "bg-gray-50 font-medium" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${cat.color}`} />
                      <span className="flex-1 truncate">{cat.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-brand-green" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Upload new version */}
          <button
            type="button"
            onClick={() => onUploadVersion(att.id)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Upload new version"
          >
            <UploadCloud className="h-4 w-4" />
          </button>
          {/* Version history */}
          <button
            type="button"
            onClick={handleShowVersions}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Version history"
          >
            <History className="h-4 w-4" />
          </button>
          {isPreviewable && att.url && (
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Preview"
            >
              <Eye className="h-4 w-4" />
            </a>
          )}
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
            onClick={() => onDelete(att.id)}
            disabled={deletingId === att.id}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Version history panel */}
      {showVersions && (
        <div className="px-4 pb-3 pl-12">
          {loadingVersions ? (
            <p className="text-xs text-gray-400">Loading versions...</p>
          ) : versions.length <= 1 ? (
            <p className="text-xs text-gray-400">No previous versions.</p>
          ) : (
            <div className="border-l-2 border-gray-100 pl-3 space-y-1.5">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className={`font-medium ${v.id === att.id ? "text-brand-dark" : "text-gray-600"}`}>
                    v{v.version_number}
                  </span>
                  <span className="text-gray-500 truncate">{v.file_name}</span>
                  <span className="text-gray-400">{formatDate(v.created_at)}</span>
                  <span className="text-gray-400">{v.uploader_name}</span>
                  {v.id === att.id && (
                    <span className="inline-flex items-center rounded-full bg-brand-green/10 text-brand-dark px-1.5 py-0.5 text-[10px] font-medium">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
