"use client";

import { useState, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronRight, Mail, Filter } from "lucide-react";
import type { CustomerEmail } from "../../lib/actions/customer-emails";

interface CustomerEmailsListProps {
  emails: CustomerEmail[];
  customerName: string;
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDate(emails: CustomerEmail[]): Record<string, CustomerEmail[]> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const groups: Record<string, CustomerEmail[]> = {};

  for (const email of emails) {
    const d = new Date(email.date);
    let key: string;

    if (d.toDateString() === now.toDateString()) {
      key = "Today";
    } else if (d >= startOfWeek) {
      key = "This Week";
    } else if (d >= lastWeekStart) {
      key = "Last Week";
    } else {
      key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    if (!groups[key]) groups[key] = [];
    groups[key]!.push(email);
  }

  return groups;
}

function EmailRow({ email }: { email: CustomerEmail }) {
  const [expanded, setExpanded] = useState(false);
  const isInbound = email.direction === "inbound";

  return (
    <div className="border-b border-gray-50 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
      >
        {/* Direction icon */}
        <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
          isInbound ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
        }`}>
          {isInbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {email.subject || "(no subject)"}
            </span>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500 truncate">
              {isInbound
                ? `From: ${email.from_name || email.from_email}`
                : `To: ${email.to_emails.map((t) => t.name || t.email).join(", ")}`}
            </span>
          </div>
          {!expanded && email.snippet && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{email.snippet}</p>
          )}
        </div>

        {/* Meta */}
        <div className="text-right shrink-0 space-y-1">
          <p className="text-xs text-gray-400">{formatRelativeDate(email.date)}</p>
          {email.ck_user_email && (
            <p className="text-[10px] text-gray-300 truncate max-w-[100px]">
              {email.ck_user_email.split("@")[0]}
            </p>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-2">
          <div className="text-xs text-gray-500 space-y-1">
            <p><span className="font-medium text-gray-600">From:</span> {email.from_name} &lt;{email.from_email}&gt;</p>
            <p><span className="font-medium text-gray-600">To:</span> {email.to_emails.map((t) => `${t.name} <${t.email}>`).join(", ")}</p>
            {email.cc_emails.length > 0 && (
              <p><span className="font-medium text-gray-600">Cc:</span> {email.cc_emails.map((c) => c.name || c.email).join(", ")}</p>
            )}
            <p><span className="font-medium text-gray-600">Date:</span> {new Date(email.date).toLocaleString()}</p>
            {email.ck_user_email && (
              <p><span className="font-medium text-gray-600">Synced from:</span> {email.ck_user_email}</p>
            )}
          </div>
          {email.body_plain && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {email.body_plain}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerEmailsList({ emails, customerName }: CustomerEmailsListProps) {
  const [directionFilter, setDirectionFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Get unique team members
  const teamMembers = useMemo(() => {
    const members = new Map<string, number>();
    for (const e of emails) {
      if (e.ck_user_email) {
        members.set(e.ck_user_email, (members.get(e.ck_user_email) ?? 0) + 1);
      }
    }
    return [...members.entries()].sort((a, b) => b[1] - a[1]);
  }, [emails]);

  // Filter emails
  const filtered = useMemo(() => {
    return emails.filter((e) => {
      if (directionFilter !== "all" && e.direction !== directionFilter) return false;
      if (teamFilter !== "all" && e.ck_user_email !== teamFilter) return false;
      return true;
    });
  }, [emails, directionFilter, teamFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  if (emails.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No emails synced for {customerName}</p>
        <p className="text-xs text-gray-400 mt-1">Click "Sync Emails" to pull emails from Gmail</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 px-4">
        <Filter className="h-3.5 w-3.5 text-gray-400" />

        {/* Direction filter */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(["all", "inbound", "outbound"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                directionFilter === dir
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {dir === "all" ? "All" : dir === "inbound" ? "Received" : "Sent"}
            </button>
          ))}
        </div>

        {/* Team member filter */}
        {teamMembers.length > 1 && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-[11px] text-gray-500 bg-gray-100 border-0 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-green"
          >
            <option value="all">All team ({emails.length})</option>
            {teamMembers.map(([email, count]) => (
              <option key={email} value={email}>
                {email.split("@")[0]} ({count})
              </option>
            ))}
          </select>
        )}

        <span className="text-[11px] text-gray-400 ml-auto">
          {filtered.length} email{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Email list grouped by date */}
      {Object.entries(grouped).map(([group, groupEmails]) => (
        <div key={group}>
          <div className="px-4 py-1.5">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group}</h4>
          </div>
          <div className="bg-white rounded-lg border border-gray-100">
            {groupEmails.map((email) => (
              <EmailRow key={email.id} email={email} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
