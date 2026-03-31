"use client";

import { useState, useCallback } from "react";
import { createSitesBatch } from "../../lib/actions";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Sparkles, Check, Loader2, MapPin, RotateCw } from "lucide-react";
import { cn, formatLabel } from "../../lib/utils";
import { SITE_PIPELINE_STAGES } from "@repo/shared";

interface FacilityResult {
  name: string;
  address: string;
  city: string;
  state: string;
  alreadyExists: boolean;
  source: string;
  // UI state
  selected: boolean;
  added: boolean;
}

interface FacilityLookupProps {
  customerName: string;
  customerDomain: string | null;
  customerId: string;
  customerTenantId: string;
  existingSites: Array<{ address: string | null }>;
}

export function FacilityLookup({
  customerName,
  customerDomain,
  customerId,
  customerTenantId,
  existingSites,
}: FacilityLookupProps) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [facilities, setFacilities] = useState<FacilityResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState("");
  const [pipelineStage, setPipelineStage] = useState("prospect");
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    setFacilities([]);
    setImportResult(null);

    try {
      const existingAddresses = existingSites
        .map((s) => s.address)
        .filter((a): a is string => !!a);

      const res = await fetch("/api/ai/discover-facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          domain: customerDomain,
          existingAddresses,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to discover facilities");
      }

      const { facilities: results, searchSummary: summary } = await res.json();

      setSearchSummary(summary || "");
      setFacilities(
        results.map((f: any) => ({
          ...f,
          selected: !f.alreadyExists,
          added: f.alreadyExists,
        }))
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSearching(false);
    }
  }, [customerName, customerDomain, existingSites]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    runSearch();
  }, [runSearch]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset state for next open
    setFacilities([]);
    setError(null);
    setSearchSummary("");
    setImportResult(null);
  }, []);

  const toggleFacility = useCallback((index: number) => {
    setFacilities((prev) =>
      prev.map((f, i) =>
        i === index && !f.added ? { ...f, selected: !f.selected } : f
      )
    );
  }, []);

  const handleImport = useCallback(async () => {
    const toImport = facilities.filter((f) => f.selected && !f.added);
    if (toImport.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const result = await createSitesBatch(
        toImport.map((f) => ({
          customerId,
          customerTenantId,
          name: f.name,
          address: f.address,
          city: f.city || null,
          state: f.state || null,
          pipelineStage: pipelineStage as any,
        }))
      );

      if ("error" in result) {
        setError(result.error ?? "Import failed");
      } else {
        setImportResult({ created: result.created, skipped: result.skipped });
        setFacilities((prev) =>
          prev.map((f) =>
            f.selected && !f.added ? { ...f, added: true, selected: false } : f
          )
        );
      }
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }, [facilities, customerId, customerTenantId, pipelineStage]);

  const selectedCount = facilities.filter((f) => f.selected && !f.added).length;
  const existingCount = facilities.filter((f) => f.alreadyExists).length;
  const addedCount = facilities.filter((f) => f.added && !f.alreadyExists).length;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        Find Facilities
      </button>

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} className="max-w-2xl">
        <DialogHeader onClose={handleClose}>
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Facility Discovery
            <span className="text-sm font-normal text-gray-400">
              {customerName}
            </span>
          </span>
        </DialogHeader>

        <DialogBody className="p-0">
          {/* Search summary */}
          {!searching && searchSummary && (
            <div className="px-6 py-2.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
              {searchSummary}
              {!searching && facilities.length > 0 && (
                <span className="ml-2 text-gray-400">
                  {facilities.length} found
                  {existingCount > 0 && ` \u00b7 ${existingCount} already in your sites`}
                  {addedCount > 0 && ` \u00b7 ${addedCount} just imported`}
                </span>
              )}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
              {!searching && (
                <button
                  onClick={runSearch}
                  className="ml-2 text-red-600 underline hover:text-red-800 text-xs"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {/* Import result banner */}
          {importResult && (
            <div className="mx-6 mt-4 rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-sm text-green-700">
              Imported {importResult.created} site{importResult.created !== 1 ? "s" : ""}
              {importResult.skipped > 0 && ` (${importResult.skipped} skipped as duplicates)`}
            </div>
          )}

          {/* Loading state */}
          {searching && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Searching for {customerName} facilities...
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  This may take a moment while we search the web
                </p>
              </div>
            </div>
          )}

          {/* Facilities list */}
          {!searching && facilities.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
              {facilities.map((f, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-6 py-2.5 transition-colors",
                    f.added
                      ? "bg-green-50/50 opacity-60"
                      : f.selected
                      ? "bg-purple-50/30"
                      : "hover:bg-gray-50"
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleFacility(i)}
                    disabled={f.added}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      f.added
                        ? "bg-green-100 border-green-300"
                        : f.selected
                        ? "bg-purple-600 border-purple-600"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                  >
                    {(f.selected || f.added) && (
                      <Check
                        className={cn(
                          "h-2.5 w-2.5",
                          f.added ? "text-green-600" : "text-white"
                        )}
                      />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {f.name}
                      </span>
                      {f.alreadyExists && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 rounded">
                          Already exists
                        </span>
                      )}
                      {f.added && !f.alreadyExists && (
                        <span className="shrink-0 text-[10px] text-green-600 font-medium">
                          Imported
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{f.address || `${f.city}, ${f.state}`}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!searching && !error && facilities.length === 0 && (
            <div className="py-12 text-center">
              <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                No facility information found for {customerName}.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try adding sites manually instead.
              </p>
            </div>
          )}
        </DialogBody>

        {/* Footer — only show when we have results */}
        {!searching && facilities.length > 0 && (
          <DialogFooter className="justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const allSelected = facilities.every(
                    (f) => f.selected || f.added
                  );
                  setFacilities((prev) =>
                    prev.map((f) =>
                      f.added ? f : { ...f, selected: !allSelected }
                    )
                  );
                }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {facilities.every((f) => f.selected || f.added)
                  ? "Deselect all"
                  : "Select all"}
              </button>

              <button
                onClick={runSearch}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
              >
                <RotateCw className="h-3 w-3" />
                Search again
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pipelineStage}
                onChange={(e) => setPipelineStage(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
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
