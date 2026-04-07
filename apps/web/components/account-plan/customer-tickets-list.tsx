"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Tag, Filter, ExternalLink } from "lucide-react";

export interface CustomerTicket {
  id: string;
  hubspot_ticket_id: string;
  subject: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  pipeline: string | null;
  pipeline_stage: string | null;
  created_date: string | null;
  modified_date: string | null;
  closed_date: string | null;
  associated_contacts: Array<{ id: string; email: string }>;
  source: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

interface CustomerTicketsListProps {
  tickets: CustomerTicket[];
  customerName: string;
  hubspotPortalId?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "1": { bg: "bg-blue-50", text: "text-blue-700" },       // New
  "2": { bg: "bg-yellow-50", text: "text-yellow-700" },    // Waiting
  "3": { bg: "bg-green-50", text: "text-green-700" },      // Closed
  "4": { bg: "bg-gray-50", text: "text-gray-600" },        // Pipeline stage
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "bg-red-50", text: "text-red-700", label: "High" },
  MEDIUM: { bg: "bg-orange-50", text: "text-orange-700", label: "Medium" },
  LOW: { bg: "bg-green-50", text: "text-green-700", label: "Low" },
};

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  // Try to determine a friendly label
  const colors = STATUS_COLORS[status] || { bg: "bg-gray-50", text: "text-gray-600" };
  // HubSpot pipeline stages are numeric IDs — display the raw value for now
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const config = PRIORITY_COLORS[priority.toUpperCase()] || {
    bg: "bg-gray-50",
    text: "text-gray-600",
    label: priority,
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function TicketRow({ ticket, hubspotPortalId }: { ticket: CustomerTicket; hubspotPortalId?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
      >
        {/* Icon */}
        <div className="mt-0.5 p-1 rounded-full shrink-0 bg-purple-50 text-purple-600">
          <Tag className="h-3.5 w-3.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {ticket.subject || "(no subject)"}
            </span>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={ticket.pipeline_stage} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.owner_name && (
              <span className="text-[10px] text-gray-400">
                {ticket.owner_name}
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="text-right shrink-0 space-y-1">
          <p className="text-xs text-gray-400">
            {formatRelativeDate(ticket.created_date)}
          </p>
          {ticket.associated_contacts.length > 0 && (
            <p className="text-[10px] text-gray-300 truncate max-w-[120px]">
              {ticket.associated_contacts.map((c) => c.email.split("@")[0]).join(", ")}
            </p>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-2">
          <div className="text-xs text-gray-500 space-y-1">
            {ticket.owner_name && (
              <p>
                <span className="font-medium text-gray-600">Owner:</span>{" "}
                {ticket.owner_name}
                {ticket.owner_email && ` <${ticket.owner_email}>`}
              </p>
            )}
            {ticket.source && (
              <p>
                <span className="font-medium text-gray-600">Source:</span>{" "}
                {ticket.source}
              </p>
            )}
            <p>
              <span className="font-medium text-gray-600">Created:</span>{" "}
              {ticket.created_date
                ? new Date(ticket.created_date).toLocaleString()
                : "Unknown"}
            </p>
            {ticket.closed_date && (
              <p>
                <span className="font-medium text-gray-600">Closed:</span>{" "}
                {new Date(ticket.closed_date).toLocaleString()}
              </p>
            )}
            {ticket.associated_contacts.length > 0 && (
              <p>
                <span className="font-medium text-gray-600">Contacts:</span>{" "}
                {ticket.associated_contacts.map((c) => c.email).join(", ")}
              </p>
            )}
          </div>
          {ticket.description && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {ticket.description}
            </div>
          )}
          {hubspotPortalId && (
            <a
              href={`https://app.hubspot.com/contacts/${hubspotPortalId}/record/0-5/${ticket.hubspot_ticket_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 text-[11px] font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View in HubSpot
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerTicketsList({
  tickets,
  customerName,
  hubspotPortalId,
}: CustomerTicketsListProps) {
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Get unique priorities and statuses
  const priorities = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      if (t.priority) set.add(t.priority);
    }
    return [...set];
  }, [tickets]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) {
      if (t.pipeline_stage) set.add(t.pipeline_stage);
    }
    return [...set];
  }, [tickets]);

  // Filter
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (statusFilter !== "all" && t.pipeline_stage !== statusFilter) return false;
      return true;
    });
  }, [tickets, priorityFilter, statusFilter]);

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <Tag className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No tickets synced for {customerName}</p>
        <p className="text-xs text-gray-400 mt-1">
          Click &quot;Sync Tickets&quot; to pull tickets from HubSpot
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 px-4 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-gray-400" />

        {/* Priority filter */}
        {priorities.length > 1 && (
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-[11px] text-gray-500 bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-green"
          >
            <option value="all">All priorities</option>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_COLORS[p.toUpperCase()]?.label || p}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        {statuses.length > 1 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[11px] text-gray-500 bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-green"
          >
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <span className="text-[11px] text-gray-400 ml-auto">
          {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Ticket list */}
      <div className="bg-white rounded-lg border border-gray-100">
        {filtered.map((ticket) => (
          <TicketRow key={ticket.id} ticket={ticket} hubspotPortalId={hubspotPortalId} />
        ))}
      </div>
    </div>
  );
}
