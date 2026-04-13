"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { getMergePreview, mergeSites } from "../../lib/actions";
import { AlertTriangle, GitMerge, Loader2, MapPin } from "lucide-react";

interface SiteOption {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
}

interface MergeSitesDialogProps {
  open: boolean;
  onClose: () => void;
  /** The site the user clicked "merge" on — pre-selected as primary */
  primarySite: SiteOption;
  /** All sibling sites (same customer) to choose secondary from */
  siblingsSites: SiteOption[];
  customerName: string;
}

interface PreviewData {
  primary: any;
  secondary: any;
  secondaryCounts: Record<string, number>;
  conflicts: string[];
}

export function MergeSitesDialog({
  open,
  onClose,
  primarySite,
  siblingsSites,
  customerName,
}: MergeSitesDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "preview" | "confirm">("select");
  const [secondarySiteId, setSecondarySiteId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const secondarySite = siblingsSites.find((s) => s.id === secondarySiteId);
  const otherSites = siblingsSites.filter((s) => s.id !== primarySite.id);

  function handleClose() {
    setStep("select");
    setSecondarySiteId("");
    setPreview(null);
    setConfirmText("");
    setError("");
    onClose();
  }

  async function handleLoadPreview() {
    if (!secondarySiteId) return;
    setLoadingPreview(true);
    setError("");
    const res = await getMergePreview(primarySite.id, secondarySiteId);
    if ("error" in res) {
      setError(res.error ?? "Failed to load preview");
      setLoadingPreview(false);
      return;
    }
    setPreview(res as PreviewData);
    setStep("preview");
    setLoadingPreview(false);
  }

  function handleMerge() {
    startTransition(async () => {
      const result = await mergeSites(primarySite.id, secondarySiteId);
      if ("error" in result) {
        setError(result.error ?? "Merge failed");
      } else {
        router.refresh();
        handleClose();
      }
    });
  }

  const totalSecondaryRecords = preview
    ? Object.values(preview.secondaryCounts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Merge Sites</DialogHeader>

      {step === "select" && (
        <>
          <DialogBody>
            <div className="space-y-4">
              {/* Primary site */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Primary (keep)</p>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">{primarySite.name}</p>
                    {primarySite.address && (
                      <p className="text-xs text-green-700">{primarySite.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Secondary site picker */}
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Merge into primary (will be deleted)
                </label>
                {otherSites.length === 0 ? (
                  <p className="text-sm text-gray-400">No other sites available for this company.</p>
                ) : (
                  <select
                    value={secondarySiteId}
                    onChange={(e) => { setSecondarySiteId(e.target.value); setError(""); }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
                  >
                    <option value="">Select a site to merge...</option>
                    {otherSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.address ? ` - ${s.address}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLoadPreview}
              disabled={!secondarySiteId || loadingPreview}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loadingPreview && <Loader2 className="h-4 w-4 animate-spin" />}
              Preview Merge
            </button>
          </DialogFooter>
        </>
      )}

      {step === "preview" && preview && secondarySite && (
        <>
          <DialogBody>
            <div className="space-y-4">
              {/* Side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold mb-1">Keep</p>
                  <p className="text-sm font-semibold text-green-900">{primarySite.name}</p>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-[10px] text-red-600 uppercase tracking-wider font-semibold mb-1">Delete</p>
                  <p className="text-sm font-semibold text-red-900">{secondarySite.name}</p>
                </div>
              </div>

              {/* Data that will move */}
              {totalSecondaryRecords > 0 && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1.5">
                    Records moving to {primarySite.name}:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {Object.entries(preview.secondaryCounts)
                      .filter(([, v]) => v > 0)
                      .map(([key, val]) => (
                        <li key={key} className="flex justify-between">
                          <span>{key.replace(/_/g, " ")}</span>
                          <span className="font-medium">{val}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Conflicts */}
              {preview.conflicts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Data conflicts</p>
                      <ul className="mt-1 text-xs text-amber-700 space-y-1">
                        {preview.conflicts.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={() => { setStep("select"); setPreview(null); setError(""); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep("confirm")}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </DialogFooter>
        </>
      )}

      {step === "confirm" && secondarySite && (
        <>
          <DialogBody>
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">This action is permanent and cannot be undone.</p>
                    <p className="mt-1 text-xs text-red-700">
                      <strong>{secondarySite.name}</strong> will be permanently deleted. Its data will be merged
                      into <strong>{primarySite.name}</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type <span className="font-bold">{secondarySite.name}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={secondarySite.name}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={() => { setStep("preview"); setConfirmText(""); setError(""); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleMerge}
              disabled={confirmText !== secondarySite.name || isPending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <GitMerge className="h-4 w-4" />
              Merge Sites
            </button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
