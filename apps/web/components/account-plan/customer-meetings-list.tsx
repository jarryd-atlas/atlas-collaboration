"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  FileText,
  CheckCircle2,
  Briefcase,
  Building2,
  Shield,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface MeetingAttendee {
  email: string;
  name: string;
  responseStatus?: string;
}

export interface CustomerMeeting {
  id: string;
  google_event_id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  meeting_end: string | null;
  location: string | null;
  html_link: string | null;
  organizer_email: string | null;
  attendees: MeetingAttendee[];
  ck_attendees: MeetingAttendee[];
  meeting_brief_id: string | null;
  synced_at: string;
}

interface CustomerMeetingsListProps {
  meetings: CustomerMeeting[];
  customerName: string;
  customerDomain: string | null;
  customerId: string;
  tenantId: string;
  accountPlanId: string;
  existingStakeholders: Array<{
    id: string;
    name: string;
    email: string | null;
    title?: string | null;
    department?: string | null;
    stakeholder_role?: string | null;
    notes?: string | null;
  }>;
  onPrepMeeting?: (meeting: CustomerMeeting) => void;
  enrichedEmails?: Set<string>;
}

const RESPONSE_COLORS: Record<string, string> = {
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  tentative: "bg-amber-100 text-amber-700",
  needsAction: "bg-gray-100 text-gray-500",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(start: string, end: string | null): string {
  const startTime = formatTime(start);
  if (!end) return startTime;
  const endTime = formatTime(end);
  return `${startTime} – ${endTime}`;
}

function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) >= new Date();
}

const ROLE_LABELS: Record<string, string> = {
  champion: "Champion",
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  user: "User",
  economic_buyer: "Economic Buyer",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  champion: "bg-green-50 text-green-700",
  decision_maker: "bg-purple-50 text-purple-700",
  influencer: "bg-blue-50 text-blue-700",
  user: "bg-gray-100 text-gray-600",
  economic_buyer: "bg-amber-50 text-amber-700",
};

export function CustomerMeetingsList({
  meetings,
  customerName,
  existingStakeholders,
  onPrepMeeting,
  enrichedEmails,
}: CustomerMeetingsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build lookup map for enriched stakeholder data by email
  const stakeholderByEmail = useMemo(() => {
    const map = new Map<string, (typeof existingStakeholders)[number]>();
    for (const s of existingStakeholders) {
      if (s.email) {
        map.set(s.email.toLowerCase(), s);
      }
    }
    return map;
  }, [existingStakeholders]);

  const { upcoming, past } = useMemo(() => {
    const up: CustomerMeeting[] = [];
    const pa: CustomerMeeting[] = [];
    for (const m of meetings) {
      if (isUpcoming(m.meeting_date)) {
        up.push(m);
      } else {
        pa.push(m);
      }
    }
    // Upcoming: soonest first
    up.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
    // Past: most recent first
    pa.sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
    return { upcoming: up, past: pa };
  }, [meetings]);

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CalendarDays className="h-10 w-10 text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-500">No meetings found</p>
        <p className="text-xs text-gray-400 mt-1">
          Sync your Google Calendar to see meetings with {customerName}
        </p>
      </div>
    );
  }

  const renderMeeting = (m: CustomerMeeting) => {
    const isExpanded = expandedId === m.id;
    const totalAttendees = m.attendees.length + m.ck_attendees.length;
    const upcoming = isUpcoming(m.meeting_date);

    // Enrichment stats
    const totalExternal = m.attendees.length;
    const enrichedCount = enrichedEmails
      ? m.attendees.filter((a) => enrichedEmails.has(a.email.toLowerCase())).length
      : 0;

    return (
      <div
        key={m.id}
        className={cn(
          "border border-gray-100 rounded-lg transition-colors",
          upcoming ? "bg-white" : "bg-gray-50/50"
        )}
      >
        {/* Header row */}
        <button
          onClick={() => setExpandedId(isExpanded ? null : m.id)}
          className="w-full flex items-start gap-3 px-4 py-3 text-left"
        >
          {/* Date badge */}
          <div className={cn(
            "shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-center",
            upcoming ? "bg-purple-50 text-purple-700" : "bg-gray-100 text-gray-500"
          )}>
            <span className="text-[10px] font-semibold uppercase leading-none">
              {new Date(m.meeting_date).toLocaleDateString("en-US", { month: "short" })}
            </span>
            <span className="text-lg font-bold leading-none mt-0.5">
              {new Date(m.meeting_date).getDate()}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">
                {m.title}
              </span>
              {m.meeting_brief_id && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 bg-purple-50 rounded">
                  <FileText className="h-2.5 w-2.5 inline mr-0.5" />
                  Brief
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeRange(m.meeting_date, m.meeting_end)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {totalAttendees} attendee{totalAttendees !== 1 ? "s" : ""}
              </span>
              {/* Enrichment indicator */}
              {enrichedEmails && totalExternal > 0 && (
                enrichedCount === totalExternal ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    All prepped
                  </span>
                ) : enrichedCount > 0 ? (
                  <span className="text-amber-600">
                    {enrichedCount}/{totalExternal} researched
                  </span>
                ) : null
              )}
              {m.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {m.location}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {upcoming && onPrepMeeting && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onPrepMeeting(m);
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100 transition-colors cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                Prep
              </span>
            )}
            {m.html_link && (
              <a
                href={m.html_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-300" />
            )}
          </div>
        </button>

        {/* Expanded attendee list */}
        {isExpanded && (
          <div className="px-4 pb-3 border-t border-gray-50">
            {/* CK attendees */}
            {m.ck_attendees.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  CK Team ({m.ck_attendees.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.ck_attendees.map((a, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* External attendees */}
            {m.attendees.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  External ({m.attendees.length})
                </div>
                <div className="space-y-2">
                  {m.attendees.map((a, i) => {
                    const stakeholder = stakeholderByEmail.get(a.email.toLowerCase());
                    const hasEnrichment = stakeholder?.title && stakeholder.title !== "Unknown";

                    return (
                      <div key={i} className={cn(
                        "rounded-md transition-colors",
                        hasEnrichment ? "bg-gray-50/80 px-2.5 py-1.5" : ""
                      )}>
                        {/* Name row */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-medium text-gray-700">{a.name}</span>
                          {hasEnrichment && stakeholder?.title && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Briefcase className="h-2.5 w-2.5" />
                              {stakeholder.title}
                            </span>
                          )}
                          {stakeholder?.stakeholder_role && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-medium",
                              ROLE_BADGE_COLORS[stakeholder.stakeholder_role] || "bg-gray-100 text-gray-600"
                            )}>
                              {ROLE_LABELS[stakeholder.stakeholder_role] || stakeholder.stakeholder_role}
                            </span>
                          )}
                          {a.responseStatus && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium",
                                RESPONSE_COLORS[a.responseStatus] || RESPONSE_COLORS.needsAction
                              )}
                            >
                              {a.responseStatus === "needsAction" ? "pending" : a.responseStatus}
                            </span>
                          )}
                        </div>
                        {/* Detail row for enriched attendees */}
                        {hasEnrichment && (
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                            <span className="text-gray-400">{a.email}</span>
                            {stakeholder?.department && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-2.5 w-2.5" />
                                {stakeholder.department}
                              </span>
                            )}
                          </div>
                        )}
                        {!hasEnrichment && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{a.email}</div>
                        )}
                        {/* Likely concerns / notes */}
                        {stakeholder?.notes && (
                          <div className="mt-1 text-[10px] text-gray-500 italic leading-relaxed">
                            <Shield className="h-2.5 w-2.5 inline mr-1 text-gray-400" />
                            {stakeholder.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Organizer */}
            {m.organizer_email && (
              <div className="mt-2 text-[10px] text-gray-400">
                Organized by {m.organizer_email}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-y-auto p-4 h-full space-y-6">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-purple-500" />
            Upcoming ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.map(renderMeeting)}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            Past ({past.length})
          </h3>
          <div className="space-y-2">
            {past.map(renderMeeting)}
          </div>
        </div>
      )}
    </div>
  );
}
