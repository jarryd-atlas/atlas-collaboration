"use client";

import { useCallback } from "react";
import { EquipmentTab } from "./equipment-tab";
import { EnergyTab } from "./energy-tab";
import { OperationsTab } from "./operations-tab";
import { SavingsTab } from "./savings-tab";
import { TouScheduleSection } from "./tou-schedule-section";
import { SiteContactsSection } from "./site-contacts-section";
import { TranscriptUpload } from "./transcript-upload";
import { CollapsibleSection } from "../ui/collapsible-section";
import { SectionStatusBadge } from "./section-status-badge";
import { ShareSectionToggle } from "./share-section-toggle";
import type { SectionStatus, DiscoverySection } from "@repo/shared";

interface SectionStatusRow {
  section_key: string;
  status: SectionStatus;
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

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
  customerId: string;
  isLocked: boolean;
  dataSources: any[];
  siteContacts: any[];
  siteContractors?: any[];
  networkDiagnostics?: any;
  networkTestResults?: any[];
  sectionStatuses?: SectionStatusRow[];
  assignableUsers?: AssignableUser[];
  isInternal?: boolean;
  sharingPermissions?: { section_key: string; shared_by: string; shared_at: string }[];
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
  customerId,
  isLocked,
  dataSources,
  siteContacts,
  siteContractors = [],
  networkDiagnostics = null,
  networkTestResults = [],
  sectionStatuses = [],
  assignableUsers = [],
  isInternal = false,
  sharingPermissions = [],
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

  // Build section status lookup
  const statusMap = new Map(sectionStatuses.map((s) => [s.section_key, s]));

  // Build sharing permissions lookup
  const sharedSections = new Set(sharingPermissions.map((p) => p.section_key));

  // For customer users, only show sections that are shared
  function isSectionVisible(sectionKey: DiscoverySection): boolean {
    if (isInternal) return true;
    return sharedSections.has(sectionKey);
  }

  function renderShareToggle(sectionKey: DiscoverySection) {
    if (!isInternal || !siteId || !tenantId) return null;
    return (
      <ShareSectionToggle
        siteId={siteId}
        tenantId={tenantId}
        sectionKey={sectionKey}
        isShared={sharedSections.has(sectionKey)}
      />
    );
  }

  function renderStatusBadge(sectionKey: DiscoverySection) {
    if (!assessment?.id) return undefined;
    const row = statusMap.get(sectionKey);
    return (
      <div className="flex items-center gap-1.5">
        {renderShareToggle(sectionKey)}
        <SectionStatusBadge
          sectionKey={sectionKey}
          status={(row?.status as SectionStatus) ?? "not_started"}
          assignee={row?.assignee}
          assessmentId={assessment.id}
          assignableUsers={assignableUsers}
          isInternal={isInternal}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Key Site Contacts */}
      {isSectionVisible("contacts") && <CollapsibleSection
        title="Key Site Contacts"
        count={siteContacts.length}
        defaultOpen={true}
        statusBadge={renderStatusBadge("contacts")}
      >
        <SiteContactsSection
          assessment={assessment}
          siteContacts={siteContacts}
          siteId={siteId}
          tenantId={tenantId}
          customerId={customerId}
          isLocked={isLocked}
        />
      </CollapsibleSection>}

      {/* Key Contractors */}
      {siteContractors.length > 0 && (
        <CollapsibleSection
          title="Key Contractors"
          count={siteContractors.length}
          defaultOpen={true}
        >
          <div className="divide-y divide-gray-100">
            {siteContractors.map((c: any) => (
              <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {c.company_name || "Unnamed Contractor"}
                    </p>
                    {c.contractor_type && (
                      <p className="text-xs text-gray-500 mt-0.5">{c.contractor_type}</p>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {c.contact_name && <span>{c.contact_name}</span>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-brand-green hover:underline">
                      {c.email}
                    </a>
                  )}
                  {c.phone && <span>{c.phone}</span>}
                </div>
                {c.notes && (
                  <p className="mt-1 text-xs text-gray-400">{c.notes}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Interview Transcripts */}
      <CollapsibleSection
        title="Interview Transcripts"
        defaultOpen={true}
      >
        <TranscriptUpload
          siteId={siteId}
          tenantId={tenantId}
          assessmentId={assessment?.id}
          isLocked={isLocked}
        />
      </CollapsibleSection>

      {/* Equipment Section */}
      {isSectionVisible("equipment") && <CollapsibleSection
        title="Equipment"
        count={equipment.length}
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_equipment"]?.map((ds: any) => ds.attachments)}
        statusBadge={renderStatusBadge("equipment")}
      >
        <EquipmentTab
          assessment={assessment}
          equipment={equipment}
          operationalParams={operationalParams}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>}

      {/* Energy & Rates Section */}
      {isSectionVisible("energy") && <CollapsibleSection
        title="Energy & Rates"
        count={energyData.length}
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_energy_data"]?.map((ds: any) => ds.attachments)}
        statusBadge={renderStatusBadge("energy")}
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
      </CollapsibleSection>}

      {/* Operations Section */}
      {isSectionVisible("operations") && <CollapsibleSection
        title="Operations"
        defaultOpen={true}
        sourceDocuments={sourcesByTable["site_operational_params"]?.map((ds: any) => ds.attachments)}
        statusBadge={renderStatusBadge("operations")}
      >
        <OperationsTab
          assessment={assessment}
          operationalParams={operationalParams}
          operations={operations}
          siteId={siteId}
          tenantId={tenantId}
          isLocked={isLocked}
        />
      </CollapsibleSection>}

      {/* Network Diagnostics Section */}
      {isSectionVisible("network") && (networkDiagnostics || networkTestResults.length > 0) && (
        <CollapsibleSection
          title="Network & Connectivity"
          count={networkTestResults.length}
          defaultOpen={true}
          statusBadge={renderStatusBadge("network")}
        >
          <div className="space-y-4">
            {/* Context info */}
            {networkDiagnostics && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {networkDiagnostics.isp_name && (
                  <div>
                    <p className="text-xs text-gray-400">ISP</p>
                    <p className="text-gray-900">{networkDiagnostics.isp_name}</p>
                  </div>
                )}
                {networkDiagnostics.connection_type && (
                  <div>
                    <p className="text-xs text-gray-400">Connection Type</p>
                    <p className="text-gray-900 capitalize">{networkDiagnostics.connection_type.replace("_", " ")}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400">Backup Connection</p>
                  <p className="text-gray-900">
                    {networkDiagnostics.has_backup_connection
                      ? networkDiagnostics.backup_connection_type || "Yes"
                      : "No"}
                  </p>
                </div>
                {networkDiagnostics.known_issues && (
                  <div className="col-span-full">
                    <p className="text-xs text-gray-400">Known Issues</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{networkDiagnostics.known_issues}</p>
                  </div>
                )}
                {networkDiagnostics.network_stability_notes && (
                  <div className="col-span-full">
                    <p className="text-xs text-gray-400">Stability Notes</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{networkDiagnostics.network_stability_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Test results table */}
            {networkTestResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left py-2 pr-4 font-medium">Date</th>
                      <th className="text-right py-2 px-2 font-medium">Download</th>
                      <th className="text-right py-2 px-2 font-medium">Upload</th>
                      <th className="text-right py-2 px-2 font-medium">Latency</th>
                      <th className="text-right py-2 px-2 font-medium">Jitter</th>
                      <th className="text-left py-2 px-2 font-medium">Location</th>
                      <th className="text-left py-2 pl-4 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {networkTestResults.map((tr: any) => (
                      <tr key={tr.id}>
                        <td className="py-2 pr-4 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(tr.tested_at).toLocaleString()}
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${
                          tr.download_mbps >= 25 ? "text-green-600" : tr.download_mbps >= 10 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {tr.download_mbps != null ? `${tr.download_mbps} Mbps` : "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${
                          tr.upload_mbps >= 10 ? "text-green-600" : tr.upload_mbps >= 5 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {tr.upload_mbps != null ? `${tr.upload_mbps} Mbps` : "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${
                          tr.latency_ms <= 50 ? "text-green-600" : tr.latency_ms <= 100 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {tr.latency_ms != null ? `${tr.latency_ms} ms` : "—"}
                        </td>
                        <td className={`py-2 px-2 text-right font-medium ${
                          tr.jitter_ms <= 10 ? "text-green-600" : tr.jitter_ms <= 30 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {tr.jitter_ms != null ? `${tr.jitter_ms} ms` : "—"}
                        </td>
                        <td className="py-2 px-2 text-gray-500 text-xs truncate max-w-[160px]" title={[tr.ip_address, tr.isp].filter(Boolean).join(" · ")}>
                          {[tr.city, tr.region].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="py-2 pl-4 text-gray-400 text-xs truncate max-w-[200px]">
                          {tr.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Savings Analysis Section */}
      {isSectionVisible("savings") && <CollapsibleSection
        title="Savings Analysis"
        defaultOpen={false}
        sourceDocuments={sourcesByTable["site_savings_analysis"]?.map((ds: any) => ds.attachments)}
        statusBadge={renderStatusBadge("savings")}
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
      </CollapsibleSection>}

      {/* Empty state for customer view when nothing is shared */}
      {!isInternal && !isSectionVisible("contacts") && !isSectionVisible("equipment") && !isSectionVisible("energy") && !isSectionVisible("operations") && !isSectionVisible("savings") && (
        <div className="text-center py-12 text-sm text-gray-400">
          No sections have been shared yet. Your CK team will share data as it becomes available.
        </div>
      )}
    </div>
  );
}
