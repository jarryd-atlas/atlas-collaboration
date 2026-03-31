"use client";

import { useState, useCallback, useRef } from "react";
import { createSitesBatch } from "../../lib/actions";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Upload, Check, Loader2, MapPin, FileSpreadsheet, X } from "lucide-react";
import { cn, formatLabel } from "../../lib/utils";
import { SITE_PIPELINE_STAGES } from "@repo/shared";

// ── Types ──────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  address: string;
  city: string;
  state: string;
  alreadyExists: boolean;
  selected: boolean;
  added: boolean;
}

interface ColumnMapping {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface ImportSitesDialogProps {
  customerName: string;
  customerId: string;
  customerTenantId: string;
  existingSites: Array<{ address: string | null }>;
}

// ── Helpers ────────────────────────────────────────────────────

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[.,#]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bplace\b/g, "pl")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, string[]> = {
  name: ["name", "site name", "site_name", "sitename", "location", "location name", "facility", "facility name"],
  address: ["address", "street", "street address", "full address", "street_address"],
  city: ["city", "town", "municipality"],
  state: ["state", "province", "st", "state/province", "region"],
};

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { name: null, address: null, city: null, state: null };
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias);
      if (idx !== -1) {
        mapping[field as keyof ColumnMapping] = headers[idx]!;
        break;
      }
    }
  }

  return mapping;
}

// ── Component ──────────────────────────────────────────────────

export function ImportSitesDialog({
  customerName,
  customerId,
  customerTenantId,
  existingSites,
}: ImportSitesDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [fileName, setFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ name: null, address: null, city: null, state: null });
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState("prospect");
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize existing addresses for comparison
  const normalizedExisting = existingSites
    .map((s) => s.address)
    .filter((a): a is string => !!a)
    .map(normalizeAddress);

  const handleClose = useCallback(() => {
    setOpen(false);
    setStep("upload");
    setFileName("");
    setRawHeaders([]);
    setRawData([]);
    setMapping({ name: null, address: null, city: null, state: null });
    setRows([]);
    setError(null);
    setImportResult(null);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError("No sheets found in file.");
        return;
      }
      const sheet = workbook.Sheets[sheetName]!;
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (data.length === 0) {
        setError("No data rows found in file.");
        return;
      }

      const headers = Object.keys(data[0]!);
      setRawHeaders(headers);
      setRawData(data);

      // Auto-detect column mapping
      const detected = detectColumnMapping(headers);
      setMapping(detected);

      // If we at least have name or address mapped, go straight to preview
      if (detected.name || detected.address) {
        applyMapping(data, detected);
        setStep("preview");
      } else {
        setStep("mapping");
      }
    } catch {
      setError("Failed to parse file. Please ensure it's a valid CSV or Excel file.");
    }
  }, [normalizedExisting]);

  const applyMapping = useCallback((data: Record<string, unknown>[], colMapping: ColumnMapping) => {
    const parsed: ParsedRow[] = data.map((row) => {
      const name = colMapping.name ? String(row[colMapping.name] ?? "").trim() : "";
      const address = colMapping.address ? String(row[colMapping.address] ?? "").trim() : "";
      const city = colMapping.city ? String(row[colMapping.city] ?? "").trim() : "";
      const state = colMapping.state ? String(row[colMapping.state] ?? "").trim() : "";

      // Build composite address if needed
      const fullAddress = address || (city ? `${city}, ${state}`.trim() : "");

      const normalizedAddr = normalizeAddress(fullAddress);
      const alreadyExists = normalizedAddr.length > 0 && normalizedExisting.some(
        (existing) =>
          existing === normalizedAddr ||
          existing.includes(normalizedAddr) ||
          normalizedAddr.includes(existing)
      );

      return {
        name: name || city || "Unnamed Site",
        address: fullAddress,
        city,
        state,
        alreadyExists,
        selected: !alreadyExists && fullAddress.length > 0,
        added: false,
      };
    }).filter((r) => r.name || r.address); // Remove completely empty rows

    setRows(parsed);
  }, [normalizedExisting]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleMappingConfirm = useCallback(() => {
    if (!mapping.name && !mapping.address) {
      setError("Please map at least a Name or Address column.");
      return;
    }
    applyMapping(rawData, mapping);
    setStep("preview");
  }, [mapping, rawData, applyMapping]);

  const toggleRow = useCallback((index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index && !r.added && !r.alreadyExists ? { ...r, selected: !r.selected } : r
      )
    );
  }, []);

  const handleImport = useCallback(async () => {
    const toImport = rows.filter((r) => r.selected && !r.added);
    if (toImport.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const result = await createSitesBatch(
        toImport.map((r) => ({
          customerId,
          customerTenantId,
          name: r.name,
          address: r.address,
          city: r.city || null,
          state: r.state || null,
          pipelineStage: pipelineStage as any,
        }))
      );

      if ("error" in result) {
        setError(result.error ?? "Import failed");
      } else {
        setImportResult({ created: result.created, skipped: result.skipped });
        setRows((prev) =>
          prev.map((r) =>
            r.selected && !r.added ? { ...r, added: true, selected: false } : r
          )
        );
      }
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [rows, customerId, customerTenantId, pipelineStage]);

  const selectedCount = rows.filter((r) => r.selected && !r.added).length;
  const existingCount = rows.filter((r) => r.alreadyExists).length;
  const addedCount = rows.filter((r) => r.added).length;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
      >
        <Upload className="h-3 w-3" />
        Import Sites
      </button>

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} className="max-w-2xl">
        <DialogHeader onClose={handleClose}>
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-gray-500" />
            Import Sites
            <span className="text-sm font-normal text-gray-400">
              {customerName}
            </span>
          </span>
        </DialogHeader>

        <DialogBody className="p-0">
          {/* Error state */}
          {error && (
            <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Import result banner */}
          {importResult && (
            <div className="mx-6 mt-4 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-700">
              Imported {importResult.created} site{importResult.created !== 1 ? "s" : ""}
              {importResult.skipped > 0 && ` (${importResult.skipped} skipped as duplicates)`}
            </div>
          )}

          {/* Step 1: File upload */}
          {step === "upload" && (
            <div className="px-6 py-8">
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                  dragOver
                    ? "border-brand-green bg-green-50/50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Drop a CSV or Excel file here
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  or click to browse. Supports .csv, .xlsx, .xls
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-3 text-center">
                Expected columns: Name, Address, City, State
              </p>
            </div>
          )}

          {/* Step 2: Column mapping */}
          {step === "mapping" && (
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{fileName}</span>
                <span className="text-gray-400">{rawData.length} rows</span>
              </div>

              <p className="text-xs text-gray-500">
                We couldn't auto-detect all columns. Please map your spreadsheet columns:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {(["name", "address", "city", "state"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                      {field} {field === "name" || field === "address" ? "*" : ""}
                    </label>
                    <select
                      value={mapping[field] || ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field]: e.target.value || null })
                      }
                      className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-green"
                    >
                      <option value="">-- Select column --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && rows.length > 0 && (
            <>
              {/* Info bar */}
              <div className="px-6 py-2.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">{fileName}</span>
                <span className="text-gray-400">
                  {rows.length} rows
                  {existingCount > 0 && ` \u00b7 ${existingCount} already in your sites`}
                  {addedCount > 0 && ` \u00b7 ${addedCount} just imported`}
                </span>
              </div>

              {/* Rows list */}
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-6 py-2.5 transition-colors",
                      r.added
                        ? "bg-green-50/50 opacity-60"
                        : r.alreadyExists
                        ? "bg-gray-50/50 opacity-60"
                        : r.selected
                        ? "bg-purple-50/30"
                        : "hover:bg-gray-50"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleRow(i)}
                      disabled={r.added || r.alreadyExists}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        r.added
                          ? "bg-green-100 border-green-300"
                          : r.alreadyExists
                          ? "bg-gray-100 border-gray-200"
                          : r.selected
                          ? "bg-purple-600 border-purple-600"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {(r.selected || r.added) && (
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            r.added ? "text-green-600" : "text-white"
                          )}
                        />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {r.name}
                        </span>
                        {r.alreadyExists && (
                          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 rounded">
                            Already exists
                          </span>
                        )}
                        {r.added && (
                          <span className="shrink-0 text-[10px] text-green-600 font-medium">
                            Imported
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{r.address || "No address"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Preview empty state */}
          {step === "preview" && rows.length === 0 && !error && (
            <div className="py-12 text-center">
              <FileSpreadsheet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No valid rows found in the file.</p>
              <button
                onClick={() => setStep("upload")}
                className="mt-2 text-xs text-purple-600 hover:text-purple-800"
              >
                Try a different file
              </button>
            </div>
          )}
        </DialogBody>

        {/* Footer */}
        {step === "mapping" && (
          <DialogFooter>
            <button
              onClick={() => setStep("upload")}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
            <button
              onClick={handleMappingConfirm}
              className="px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </DialogFooter>
        )}

        {step === "preview" && rows.length > 0 && (
          <DialogFooter className="justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const allSelected = rows.every((r) => r.selected || r.added || r.alreadyExists);
                  setRows((prev) =>
                    prev.map((r) =>
                      r.added || r.alreadyExists ? r : { ...r, selected: !allSelected }
                    )
                  );
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {rows.every((r) => r.selected || r.added || r.alreadyExists)
                  ? "Deselect all"
                  : "Select all"}
              </button>

              <button
                onClick={() => { setStep("upload"); setRows([]); setImportResult(null); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Upload different file
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pipelineStage}
                onChange={(e) => setPipelineStage(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-green"
              >
                {SITE_PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {formatLabel(s)}
                  </option>
                ))}
              </select>

              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <MapPin className="h-3 w-3" /> Import {selectedCount} Site{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </DialogFooter>
        )}
      </Dialog>
    </>
  );
}
