"use client";

import { useCallback } from "react";
import { EquipmentTab } from "./equipment-tab";
import { EnergyTab } from "./energy-tab";
import { OperationsTab } from "./operations-tab";
import { SavingsTab } from "./savings-tab";
import { TouScheduleSection } from "./tou-schedule-section";
import { SiteContactsSection } from "./site-contacts-section";
import { CollapsibleSection } from "../ui/collapsible-section";

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
  siteContacts: any[];
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
  siteContacts,
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
      {/* Key Site Contacts */}
      <CollapsibleSection
        title="Key Site Contacts"
        count={siteContacts.length}
        defaultOpen={true}
      >
        <SiteContactsSection
          assessment={assessment}
          siteContacts={siteContacts}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>

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
