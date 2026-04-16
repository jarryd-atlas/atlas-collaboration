"use client";

import { Circle, MessageSquare, CheckSquare, Target, FileText, Building2 } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { formatActivity, timeAgo } from "../../lib/utils/activity-format";
import type { ActivityItem } from "../../lib/utils/activity-format";

interface ActivityFeedProps {
  activities: ActivityItem[];
  variant: "compact" | "full";
  showSiteName?: boolean;
  showCustomerName?: boolean;
  emptyMessage?: string;
  maxItems?: number;
  viewAllHref?: string;
}

const ICON_MAP = {
  status: Circle,
  info_request: MessageSquare,
  task: CheckSquare,
  milestone: Target,
  document: FileText,
  site: Building2,
} as const;

export function ActivityFeed({
  activities,
  variant,
  showSiteName = false,
  showCustomerName = false,
  emptyMessage = "No recent activity",
  maxItems,
  viewAllHref,
}: ActivityFeedProps) {
  const items = maxItems ? activities.slice(0, maxItems) : activities;
  const hasMore = maxItems ? activities.length > maxItems : false;

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-6">{emptyMessage}</p>
    );
  }

  if (variant === "compact") {
    return (
      <div className="space-y-0.5">
        {items.map((item) => {
          const formatted = formatActivity(item);
          const Icon = ICON_MAP[formatted.icon] ?? Circle;
          return (
            <div key={item.id} className="flex items-start gap-2.5 py-1.5">
              <div className={`mt-0.5 shrink-0 ${formatted.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 leading-relaxed truncate">
                  {formatted.description}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-400">{timeAgo(item.created_at)}</span>
                  {showSiteName && item.site?.name && (
                    <span className="text-[10px] text-gray-400">· {item.site.name}</span>
                  )}
                  {showCustomerName && item.customer?.name && (
                    <span className="text-[10px] text-gray-400">· {item.customer.name}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {hasMore && viewAllHref && (
          <a
            href={viewAllHref}
            className="block text-center text-[11px] text-brand-green font-medium py-1.5 hover:underline"
          >
            View all activity
          </a>
        )}
      </div>
    );
  }

  // Full variant — more spacious, grouped by date, with avatars
  const groupedByDate = groupByDate(items);

  return (
    <div className="space-y-6">
      {groupedByDate.map(([dateLabel, dateItems]) => (
        <div key={dateLabel}>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            {dateLabel}
          </p>
          <div className="space-y-0">
            {dateItems.map((item) => {
              const formatted = formatActivity(item);
              const Icon = ICON_MAP[formatted.icon] ?? Circle;
              return (
                <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <Avatar
                    name={item.actor?.full_name ?? "?"}
                    src={item.actor?.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {formatted.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{timeAgo(item.created_at)}</span>
                      {showSiteName && item.site?.name && (
                        <span className="text-xs text-gray-400">· {item.site.name}</span>
                      )}
                      {showCustomerName && item.customer?.name && (
                        <span className="text-xs text-gray-400">· {item.customer.name}</span>
                      )}
                    </div>
                    {formatted.detail && (
                      <p className="text-xs text-gray-400 mt-1">{formatted.detail}</p>
                    )}
                  </div>
                  <div className={`mt-0.5 shrink-0 ${formatted.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDate(items: ActivityItem[]): [string, ActivityItem[]][] {
  const groups = new Map<string, ActivityItem[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const item of items) {
    const date = new Date(item.created_at);
    let label: string;

    if (isSameDay(date, today)) {
      label = "Today";
    } else if (isSameDay(date, yesterday)) {
      label = "Yesterday";
    } else if (isWithinDays(date, today, 7)) {
      label = date.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      label = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }

  return Array.from(groups.entries());
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinDays(date: Date, reference: Date, days: number): boolean {
  const diff = reference.getTime() - date.getTime();
  return diff >= 0 && diff < days * 24 * 60 * 60 * 1000;
}
