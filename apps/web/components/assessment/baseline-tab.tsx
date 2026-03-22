"use client";

import { useState, useCallback } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { EquipmentTab } from "./equipment-tab";
import { EnergyTab } from "./energy-tab";
import { OperationsTab } from "./operations-tab";
import { SavingsTab } from "./savings-tab";
import { TouScheduleSection } from "./tou-schedule-section";

interface BaselineTabProps {
  assessment: any;
  equipment: any[];
  energyData: any[];
  rateStructure: any;
  touSchedule: any;
  operationalParams: any;
  operations: any;
  loadBreakdown: any;
  arcoPerformance: any;
  savingsAnalysis: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
  dataSources: any[];
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
  sourceDocuments,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  sourceDocuments?: Array<{ file_name: string }>;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {count !== undefined && (
            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              {count}
            </span>
          )}
          {sourceDocuments && sourceDocuments.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              <FileText className="h-3 w-3" />
              AI extracted
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-6 py-6 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

export function BaselineTab({
  assessment,
  equipment,
  energyData,
  rateStructure,
  touSchedule,
  operationalParams,
  operations,
  loadBreakdown,
  arcoPerformance,
  savingsAnalysis,
  siteId,
  tenantId,
  isLocked,
  dataSources,
}: BaselineTabProps) {
  // Group data sources by table for attribution badges
  const sourcesByTable = dataSources.reduce(
    (acc: Record<string, any[]>, ds: any) => {
      const table = ds.target_table;
      if (!acc[table]) acc[table] = [];
      acc[table].push(ds);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {/* Equipment Section */}
      <CollapsibleSection
        title="Equipment"
        count={equipment.length}
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_equipment"]?.map((ds: any) => ds.attachments)}
      >
        <EquipmentTab
          assessment={assessment}
          equipment={equipment}
          operationalParams={operationalParams}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>

      {/* Energy & Rates Section */}
      <CollapsibleSection
        title="Energy & Rates"
        count={energyData.length}
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_energy_data"]?.map((ds: any) => ds.attachments)}
      >
        <div className="space-y-6">
          {/* TOU Rate Schedule */}
          <TouScheduleSection
            assessment={assessment}
            touSchedule={touSchedule}
            rateStructure={rateStructure}
            siteId={siteId}
            tenantId={tenantId}
            isLocked={isLocked}
          />

          {/* Monthly Energy Data */}
          <EnergyTab
            assessment={assessment}
            energyData={energyData}
            rateStructure={rateStructure}
            siteId={siteId}
            tenantId={tenantId}
            isLocked={isLocked}
          />
        </div>
      </CollapsibleSection>

      {/* Operations Section */}
      <CollapsibleSection
        title="Operations"
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_operational_params"]?.map((ds: any) => ds.attachments)}
      >
        <OperationsTab
          assessment={assessment}
          operationalParams={operationalParams}
          operations={operations}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>

      {/* Savings Analysis Section */}
      <CollapsibleSection
        title="Savings Analysis"
        defaultOpen={false}
        sourceDocuments={sourcesByTable["site_savings_analysis"]?.map((ds: any) => ds.attachments)}
      >
        <SavingsTab
          assessment={assessment}
          equipment={equipment}
          energyData={energyData}
          operationalParams={operationalParams}
          loadBreakdown={loadBreakdown}
          arcoPerformance={arcoPerformance}
          savingsAnalysis={savingsAnalysis}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>
    </div>
  );
}
