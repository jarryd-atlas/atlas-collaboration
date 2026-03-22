"use client";

import { useState } from "react";
import { X, Check, FileText, Sparkles, AlertTriangle } from "lucide-react";
import type { BaselineExtraction } from "@repo/ai";

interface AIExtractionReviewProps {
  open: boolean;
  onClose: () => void;
  extractionId: string;
  extraction: BaselineExtraction;
  attachmentName: string;
  assessmentId: string;
  siteId: string;
  tenantId: string;
  attachmentId: string;
}

export function AIExtractionReview({
  open,
  onClose,
  extractionId,
  extraction,
  attachmentName,
  assessmentId,
  siteId,
  tenantId,
  attachmentId,
}: AIExtractionReviewProps) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  // Track which sections user wants to apply
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(extraction.sectionsFound),
  );

  if (!open) return null;

  function toggleSection(section: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  async function handleApply() {
    setApplying(true);
    setError("");

    // Build accepted data based on selected sections
    const acceptedData: Partial<BaselineExtraction> = {
      confidence: extraction.confidence,
    };

    if (selectedSections.has("equipment") && extraction.equipment) {
      acceptedData.equipment = extraction.equipment;
    }
    if (selectedSections.has("energyData") && extraction.energyData) {
      acceptedData.energyData = extraction.energyData;
    }
    if (selectedSections.has("touSchedule") && extraction.touSchedule) {
      acceptedData.touSchedule = extraction.touSchedule;
    }
    if (selectedSections.has("rateStructure") && extraction.rateStructure) {
      acceptedData.rateStructure = extraction.rateStructure;
    }
    if (selectedSections.has("operationalParams") && extraction.operationalParams) {
      acceptedData.operationalParams = extraction.operationalParams;
    }
    if (selectedSections.has("operations") && extraction.operations) {
      acceptedData.operations = extraction.operations;
    }
    if (selectedSections.has("labor") && extraction.labor) {
      acceptedData.labor = extraction.labor;
    }

    try {
      const res = await fetch("/api/ai/apply-extraction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractionId,
          assessmentId,
          siteId,
          tenantId,
          acceptedData,
          attachmentId,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error ?? "Failed to apply extraction");
      } else {
        setApplied(true);
        // Auto-close after a short delay
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      }
    } catch {
      setError("Network error while applying extraction");
    } finally {
      setApplying(false);
    }
  }

  const confidenceColor =
    extraction.confidence >= 0.8
      ? "text-green-600"
      : extraction.confidence >= 0.5
        ? "text-amber-600"
        : "text-red-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">AI Extraction Review</h2>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {attachmentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Confidence */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Confidence:</span>
            <span className={`font-semibold ${confidenceColor}`}>
              {(extraction.confidence * 100).toFixed(0)}%
            </span>
            {extraction.notes && (
              <span className="text-gray-400 text-xs">— {extraction.notes}</span>
            )}
          </div>

          {/* Sections */}
          {extraction.equipment && extraction.equipment.length > 0 && (
            <SectionCard
              title="Equipment"
              sectionKey="equipment"
              selected={selectedSections.has("equipment")}
              onToggle={() => toggleSection("equipment")}
            >
              <p className="text-xs text-gray-500">
                {extraction.equipment.length} equipment item{extraction.equipment.length !== 1 ? "s" : ""} found
              </p>
              <ul className="mt-1 space-y-0.5">
                {extraction.equipment.map((eq, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {eq.category}: {eq.name || eq.manufacturer || "Unknown"} {eq.specs?.hp ? `(${eq.specs.hp} HP)` : ""}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {extraction.energyData && extraction.energyData.length > 0 && (
            <SectionCard
              title="Energy Data"
              sectionKey="energyData"
              selected={selectedSections.has("energyData")}
              onToggle={() => toggleSection("energyData")}
            >
              <p className="text-xs text-gray-500">
                {extraction.energyData.length} month{extraction.energyData.length !== 1 ? "s" : ""} of utility data
              </p>
              <ul className="mt-1 space-y-0.5">
                {extraction.energyData.map((ed, i) => (
                  <li key={i} className="text-xs text-gray-600">
                    {ed.periodMonth}: {ed.totalKwh ? `${ed.totalKwh.toLocaleString()} kWh` : ""}{" "}
                    {ed.totalCharges ? `$${ed.totalCharges.toLocaleString()}` : ""}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {extraction.touSchedule && (
            <SectionCard
              title="TOU Rate Schedule"
              sectionKey="touSchedule"
              selected={selectedSections.has("touSchedule")}
              onToggle={() => toggleSection("touSchedule")}
            >
              <div className="text-xs text-gray-600 space-y-0.5">
                {extraction.touSchedule.supplyProvider && (
                  <p>Supply: {extraction.touSchedule.supplyProvider}</p>
                )}
                {extraction.touSchedule.distributionProvider && (
                  <p>Distribution: {extraction.touSchedule.distributionProvider}</p>
                )}
                {extraction.touSchedule.onPeakEnergyRate && (
                  <p>On-Peak: ${extraction.touSchedule.onPeakEnergyRate}/kWh</p>
                )}
                {extraction.touSchedule.offPeakEnergyRate && (
                  <p>Off-Peak: ${extraction.touSchedule.offPeakEnergyRate}/kWh</p>
                )}
              </div>
            </SectionCard>
          )}

          {extraction.rateStructure && (
            <SectionCard
              title="Rate Structure"
              sectionKey="rateStructure"
              selected={selectedSections.has("rateStructure")}
              onToggle={() => toggleSection("rateStructure")}
            >
              <div className="text-xs text-gray-600 space-y-0.5">
                {extraction.rateStructure.cpZone && <p>CP Zone: {extraction.rateStructure.cpZone}</p>}
                {extraction.rateStructure.capacityRatePerKwYr && (
                  <p>Capacity Rate: ${extraction.rateStructure.capacityRatePerKwYr}/kW-yr</p>
                )}
              </div>
            </SectionCard>
          )}

          {extraction.operationalParams && (
            <SectionCard
              title="Operational Parameters"
              sectionKey="operationalParams"
              selected={selectedSections.has("operationalParams")}
              onToggle={() => toggleSection("operationalParams")}
            >
              <div className="text-xs text-gray-600 space-y-0.5">
                {extraction.operationalParams.systemType && (
                  <p>System: {extraction.operationalParams.systemType}</p>
                )}
                {extraction.operationalParams.refrigerant && (
                  <p>Refrigerant: {extraction.operationalParams.refrigerant}</p>
                )}
                {extraction.operationalParams.facilityType && (
                  <p>Facility: {extraction.operationalParams.facilityType}</p>
                )}
              </div>
            </SectionCard>
          )}

          {extraction.operations && (
            <SectionCard
              title="Operations"
              sectionKey="operations"
              selected={selectedSections.has("operations")}
              onToggle={() => toggleSection("operations")}
            >
              <div className="text-xs text-gray-600 space-y-0.5">
                {extraction.operations.dischargePressureTypical && (
                  <p>Discharge: {extraction.operations.dischargePressureTypical} psig</p>
                )}
                {extraction.operations.suctionPressureTypical && (
                  <p>Suction: {extraction.operations.suctionPressureTypical} psig</p>
                )}
              </div>
            </SectionCard>
          )}

          {extraction.labor && (
            <SectionCard
              title="Labor"
              sectionKey="labor"
              selected={selectedSections.has("labor")}
              onToggle={() => toggleSection("labor")}
            >
              <div className="text-xs text-gray-600 space-y-0.5">
                {extraction.labor.headcount && extraction.labor.headcount.length > 0 && (
                  <p>{extraction.labor.headcount.length} role(s) found</p>
                )}
                {extraction.labor.painPoints && <p>Pain points noted</p>}
              </div>
            </SectionCard>
          )}

          {extraction.sectionsFound.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              No extractable data found in this document.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {error}
            </p>
          )}
          {applied && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Applied successfully!
            </p>
          )}
          {!error && !applied && <div />}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || applied || selectedSections.size === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {applying ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Applying...
                </>
              ) : applied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Applied!
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Apply Selected ({selectedSections.size})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  sectionKey,
  selected,
  onToggle,
  children,
}: {
  title: string;
  sectionKey: string;
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors cursor-pointer ${
        selected
          ? "border-purple-200 bg-purple-50/30"
          : "border-gray-100 bg-gray-50/50 opacity-60"
      }`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}
