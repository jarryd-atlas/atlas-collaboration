"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyTypeBadge } from "../ui/badge";
import { CustomerPortalLink } from "../layout/customer-portal-link";
import { Avatar } from "../ui/avatar";
import { CustomerTeamManager } from "../forms/customer-team-manager";
import { CustomerActions } from "../forms/customer-actions";
import { Users, Plus, ChevronDown } from "lucide-react";

interface TeamMember {
  id: string;
  role_label: string | null;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface InternalProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface CompactCustomerHeaderProps {
  customer: {
    id: string;
    name: string;
    domain: string | null;
    company_type: string | null;
    tenant_id: string;
  };
  customerSlug: string;
  stats: {
    activeSites: number;
    evaluatingSites: number;
    deployingSites: number;
    openTasks: number;
    openIssues: number;
  };
  isCKInternal: boolean;
  ckTeam: TeamMember[];
  internalProfiles: InternalProfile[];
  sites: Array<{ id: string; name: string; slug: string; tenant_id: string; [key: string]: unknown }>;
}

export function CompactCustomerHeader({
  customer,
  customerSlug,
  stats,
  isCKInternal,
  ckTeam,
  internalProfiles,
  sites,
}: CompactCustomerHeaderProps) {
  const [showTeamPopover, setShowTeamPopover] = useState(false);

  return (
    <div className="space-y-2 pb-4 border-b border-gray-100">
      {/* Row 1: Breadcrumb + name + portal link */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-400 mb-1">
            <Link href="/customers" className="hover:text-gray-600">Companies</Link>
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <CompanyTypeBadge type={customer.company_type ?? "customer"} />
          </div>
          {customer.domain && (
            <p className="text-gray-500 text-sm mt-0.5">{customer.domain}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CustomerPortalLink
            currentPath={`/customers/${customerSlug}`}
            customerSlug={customerSlug}
          />
        </div>
      </div>

      {/* Row 2: Stats pills + team avatars + actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stat pills */}
          <StatPill label="Active" value={stats.activeSites} />
          <StatPill label="Eval" value={stats.evaluatingSites} />
          <StatPill label="Deploying" value={stats.deployingSites} />
          <span className="w-px h-4 bg-gray-200" />
          <StatPill label="Tasks" value={stats.openTasks} />
          {stats.openIssues > 0 && (
            <StatPill label="Issues" value={stats.openIssues} accent />
          )}

          {/* CK Team avatar stack */}
          {isCKInternal && (
            <>
              <span className="w-px h-4 bg-gray-200" />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTeamPopover(!showTeamPopover)}
                  className="flex items-center gap-1 hover:bg-gray-50 rounded-lg px-1.5 py-1 transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <div className="flex -space-x-1.5">
                    {ckTeam.slice(0, 3).map((m) => (
                      <Avatar
                        key={m.profile.id}
                        name={m.profile.full_name}
                        src={m.profile.avatar_url}
                        size="sm"
                        className="ring-2 ring-white"
                      />
                    ))}
                  </div>
                  {ckTeam.length > 3 && (
                    <span className="text-xs text-gray-400">+{ckTeam.length - 3}</span>
                  )}
                  {ckTeam.length === 0 && (
                    <span className="text-xs text-gray-400">No team</span>
                  )}
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </button>

                {/* Team popover */}
                {showTeamPopover && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowTeamPopover(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 z-40 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-80">
                      <CustomerTeamManager
                        customerId={customer.id}
                        teamMembers={ckTeam}
                        internalProfiles={internalProfiles}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Quick actions */}
        <CustomerActions
          customerName={customer.name}
          customerId={customer.id}
          customerTenantId={customer.tenant_id}
          sites={sites}
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        accent && value > 0
          ? "bg-red-50 text-red-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
      <span className={accent && value > 0 ? "font-bold" : "font-semibold"}>
        {value}
      </span>
    </span>
  );
}
