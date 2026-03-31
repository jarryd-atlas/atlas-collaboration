"use client";

import { useMemo } from "react";
import { CalendarDays, Users, ArrowRight, ExternalLink } from "lucide-react";

interface MeetingAttendee {
  email: string;
  name: string;
  responseStatus?: string;
}

interface CustomerMeeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_end: string | null;
  html_link?: string | null;
  attendees: MeetingAttendee[];
  ck_attendees: MeetingAttendee[];
}

interface MeetingsOverviewCardProps {
  meetings: CustomerMeeting[];
  customerName: string;
  onViewAll?: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEndOfNextWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilEndOfNextWeek = 13 - dayOfWeek; // Saturday of next week
  const end = new Date(now);
  end.setDate(now.getDate() + daysUntilEndOfNextWeek);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfThisWeek(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay()); // Sunday
  start.setHours(0, 0, 0, 0);
  return start;
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

export function MeetingsOverviewCard({
  meetings,
  customerName,
  onViewAll,
}: MeetingsOverviewCardProps) {
  const { thisWeek, nextWeek, pastCount } = useMemo(() => {
    const now = new Date();
    const startOfWeek = getStartOfThisWeek();
    const endOfNextWeek = getEndOfNextWeek();
    const endOfThisWeek = new Date(startOfWeek);
    endOfThisWeek.setDate(startOfWeek.getDate() + 6);
    endOfThisWeek.setHours(23, 59, 59, 999);
    const startOfNextWeek = new Date(endOfThisWeek);
    startOfNextWeek.setDate(endOfThisWeek.getDate() + 1);
    startOfNextWeek.setHours(0, 0, 0, 0);

    const tw: CustomerMeeting[] = [];
    const nw: CustomerMeeting[] = [];
    let past = 0;

    for (const m of meetings) {
      const d = new Date(m.meeting_date);
      if (d >= startOfWeek && d <= endOfThisWeek) {
        tw.push(m);
      } else if (d >= startOfNextWeek && d <= endOfNextWeek) {
        nw.push(m);
      } else if (d < startOfWeek) {
        past++;
      }
    }

    tw.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());
    nw.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());

    return { thisWeek: tw, nextWeek: nw, pastCount: past };
  }, [meetings]);

  const hasMeetings = thisWeek.length > 0 || nextWeek.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-purple-500" />
          Meetings
        </h3>
        {onViewAll && meetings.length > 0 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-[10px] font-medium text-purple-600 hover:text-purple-800 transition-colors"
          >
            View All ({meetings.length})
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {!hasMeetings && pastCount === 0 && (
        <p className="text-xs text-gray-400 py-2">
          No meetings synced for {customerName}
        </p>
      )}

      {!hasMeetings && pastCount > 0 && (
        <p className="text-xs text-gray-400 py-2">
          No upcoming meetings · {pastCount} past meeting{pastCount !== 1 ? "s" : ""}
        </p>
      )}

      {hasMeetings && (
        <div className="space-y-3">
          {/* This Week */}
          {thisWeek.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                This Week ({thisWeek.length})
              </div>
              <div className="space-y-1.5">
                {thisWeek.map((m) => (
                  <MeetingRow key={m.id} meeting={m} />
                ))}
              </div>
            </div>
          )}

          {/* Next Week */}
          {nextWeek.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Next Week ({nextWeek.length})
              </div>
              <div className="space-y-1.5">
                {nextWeek.map((m) => (
                  <MeetingRow key={m.id} meeting={m} />
                ))}
              </div>
            </div>
          )}

          {pastCount > 0 && (
            <div className="text-[10px] text-gray-400">
              + {pastCount} past meeting{pastCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingRow({ meeting: m }: { meeting: CustomerMeeting }) {
  const totalAttendees = m.attendees.length + m.ck_attendees.length;
  const isPast = new Date(m.meeting_date) < new Date();

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        isPast
          ? "bg-gray-50/50"
          : "bg-purple-50/50 border border-purple-100/50"
      }`}
    >
      {/* Date + time */}
      <div className="shrink-0 text-center w-16">
        <div className={`text-[10px] font-semibold ${isPast ? "text-gray-400" : "text-purple-600"}`}>
          {formatDate(m.meeting_date)}
        </div>
        <div className={`text-[10px] ${isPast ? "text-gray-300" : "text-purple-400"}`}>
          {formatTime(m.meeting_date)}
        </div>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${isPast ? "text-gray-500" : "text-gray-900"}`}>
          {m.title}
        </div>
        <div className="text-[10px] text-gray-400 flex items-center gap-2">
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {totalAttendees}
          </span>
          {m.ck_attendees.length > 0 && (
            <span className="truncate">
              CK: {m.ck_attendees.slice(0, 2).map((a) => a.name.split(" ")[0]).join(", ")}
              {m.ck_attendees.length > 2 && ` +${m.ck_attendees.length - 2}`}
            </span>
          )}
        </div>
      </div>

      {/* Calendar link */}
      {m.html_link && (
        <a
          href={m.html_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
