"use client";

import { useMemo } from "react";
import { Users, ExternalLink } from "lucide-react";

interface DashboardMeeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_end: string | null;
  html_link: string | null;
  attendees: { email: string; name: string }[];
  ck_attendees: { email: string; name: string }[];
  customer_id: string;
  customer_name: string;
  customer_slug: string;
}

export function DashboardMeetingsClient({ meetings }: { meetings: DashboardMeeting[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DashboardMeeting[]>();
    for (const m of meetings) {
      // Group by LOCAL date
      const localDate = new Date(m.meeting_date).toLocaleDateString("en-CA"); // YYYY-MM-DD
      if (!map.has(localDate)) map.set(localDate, []);
      map.get(localDate)!.push(m);
    }
    return map;
  }, [meetings]);

  return (
    <div className="space-y-3">
      {[...grouped.entries()].map(([day, dayMeetings]) => (
        <div key={day}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            {formatDayLabel(day)}
          </p>
          <div className="space-y-1">
            {dayMeetings.map((m) => (
              <MeetingRow key={m.id} meeting={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MeetingRow({ meeting: m }: { meeting: DashboardMeeting }) {
  const totalAttendees = m.attendees.length + m.ck_attendees.length;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-purple-50/40 border border-purple-100/30">
      <span className="text-[10px] font-semibold text-purple-600 w-14 shrink-0 tabular-nums">
        {formatTime(m.meeting_date)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-900 truncate">{m.title}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {m.customer_name}
          {m.ck_attendees.length > 0 && (
            <span className="ml-1">
              · {m.ck_attendees.slice(0, 2).map((a) => a.name.split(" ")[0]).join(", ")}
              {m.ck_attendees.length > 2 && ` +${m.ck_attendees.length - 2}`}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />
          {totalAttendees}
        </span>
        {m.html_link && (
          <a
            href={m.html_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // noon to avoid timezone edge
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
