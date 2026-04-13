"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { CustomerSearch } from "../ui/customer-search";
import { getTransferPreview, transferSite } from "../../lib/actions";
import { AlertTriangle, ArrowRight, Building2, Loader2 } from "lucide-react";

interface TransferSiteDialogProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  currentCustomerId: string;
  currentCustomerName: string;
}

interface PreviewData {
  site: { id: string; name: string; slug: string; address: string };
  counts: Record<string, number>;
}

export function TransferSiteDialog({
  open,
  onClose,
  siteId,
  siteName,
  currentCustomerId,
  currentCustomerName,
}: TransferSiteDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [targetCustomer, setTargetCustomer] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load preview when dialog opens
  useEffect(() => {
    if (open && !preview) {
      setLoadingPreview(true);
      getTransferPreview(siteId).then((res) => {
        if ("error" in res) {
          setError(res.error ?? "Failed to load preview");
        } else {
          setPreview(res as PreviewData);
        }
        setLoadingPreview(false);
      });
    }
  }, [open, siteId, preview]);

  function handleClose() {
    setStep("select");
    setTargetCustomer(null);
    setError("");
    onClose();
  }

  function handleSelectCustomer(customer: { id: string; name: string; slug: string }) {
    setTargetCustomer(customer);
    setError("");
  }

  function handleContinue() {
    if (!targetCustomer) return;
    setStep("confirm");
  }

  function handleTransfer() {
    if (!targetCustomer) return;
    startTransition(async () => {
      const result = await transferSite(siteId, targetCustomer.id);
      if ("error" in result) {
        setError(result.error ?? "Transfer failed");
      } else {
        router.refresh();
        handleClose();
      }
    });
  }

  const totalChildRecords = preview
    ? Object.values(preview.counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader onClose={handleClose}>Transfer Site</DialogHeader>

      {step === "select" && (
        <>
          <DialogBody>
            <div className="space-y-4">
              {/* Current location */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Transferring</p>
                <p className="text-sm font-semibold text-gray-900">{siteName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Currently under <span className="font-medium text-gray-700">{currentCustomerName}</span>
                </p>
              </div>

              {/* Data summary */}
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading site data...
                </div>
              ) : preview && totalChildRecords > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {totalChildRecords} linked records will transfer
                      </p>
                      <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                        {Object.entries(preview.counts)
                          .filter(([, v]) => v > 0)
                          .map(([key, val]) => (
                            <li key={key}>
                              {val} {key.replace(/_/g, " ")}
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Target customer search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Transfer to
                </label>
                <CustomerSearch
                  onSelect={handleSelectCustomer}
                  excludeCustomerId={currentCustomerId}
                  placeholder="Search for target company..."
                />
                {targetCustomer && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                    <Building2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-800">{targetCustomer.name}</span>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
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
              onClick={handleContinue}
              disabled={!targetCustomer}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          </DialogFooter>
        </>
      )}

      {step === "confirm" && targetCustomer && (
        <>
          <DialogBody>
            <div className="space-y-4">
              {/* Transfer summary */}
              <div className="flex items-center gap-3 justify-center py-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">From</p>
                  <p className="text-sm font-semibold text-gray-900">{currentCustomerName}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">To</p>
                  <p className="text-sm font-semibold text-gray-900">{targetCustomer.name}</p>
                </div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">This action cannot be easily undone.</p>
                    <p className="mt-1 text-xs text-red-700">
                      <strong>{siteName}</strong> and all its data ({totalChildRecords} records) will move to{" "}
                      <strong>{targetCustomer.name}</strong>. Existing site access permissions will be cleared.
                    </p>
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <button
              onClick={() => { setStep("select"); setError(""); }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleTransfer}
              disabled={isPending}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Transfer Site
            </button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
