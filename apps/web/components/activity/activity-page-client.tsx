"use client";

import { useState, useTransition, useCallback } from "react";
import { ActivityFeed } from "./activity-feed";
import { Activity, Filter, X } from "lucide-react";
import type { ActivityItem } from "../../lib/utils/activity-format";

interface ActivityPageClientProps {
  initialActivities: ActivityItem[];
  customers: { id: string; name: string }[];
  teamMembers: { id: string; name: string }[];
  tenantId: string;
}

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "section_status", label: "Status Changes" },
  { value: "info_request", label: "Info Requests" },
  { value: "task", label: "Tasks" },
  { value: "milestone", label: "Milestones" },
  { value: "document", label: "Documents" },
  { value: "site", label: "Baseline Updates" },
];

export function ActivityPageClient({
  initialActivities,
  customers,
  teamMembers,
  tenantId,
}: ActivityPageClientProps) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [customerId, setCustomerId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorId, setActorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasFilters = !!(customerId || entityType || actorId || dateFrom || dateTo);

  const applyFilters = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams();
      params.set("tenantId", tenantId);
      if (customerId) params.set("customerId", customerId);
      if (entityType) params.set("entityType", entityType);
      if (actorId) params.set("actorId", actorId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      try {
        const res = await fetch(`/api/activity?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data);
        }
      } catch {
        // Keep existing data on error
      }
    });
  }, [tenantId, customerId, entityType, actorId, dateFrom, dateTo]);

  const clearFilters = useCallback(() => {
    setCustomerId("");
    setEntityType("");
    setActorId("");
    setDateFrom("");
    setDateTo("");
    setActivities(initialActivities);
  }, [initialActivities]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-500" />
          Activity Feed
        </h1>
        <p className="text-gray-500 mt-1">Track all changes across your portfolio</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Customer */}
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <option value="">All Companies</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Entity Type */}
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Team Member */}
          <select
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          >
            <option value="">All Team Members</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Date From */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />

          {/* Date To */}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>
        <div className="mt-3">
          <button
            onClick={applyFilters}
            disabled={isPending}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isPending
                ? "bg-gray-100 text-gray-400"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {isPending ? "Loading..." : "Apply Filters"}
          </button>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card px-5 py-4">
        <ActivityFeed
          activities={activities}
          variant="full"
          showSiteName={true}
          showCustomerName={true}
          emptyMessage="No activity matches your filters"
        />
      </div>
    </div>
  );
}
