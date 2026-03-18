"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  getNotifications,
  getUnreadNotificationCount,
  type Notification,
  type NotificationType,
} from "../../lib/mock-data";
import {
  Bell,
  ListTodo,
  MessageSquare,
  FileText,
  AlertTriangle,
  Target,
  UserPlus,
} from "lucide-react";
import { cn } from "../../lib/utils";

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  task_assigned: <ListTodo className="h-4 w-4" />,
  comment_added: <MessageSquare className="h-4 w-4" />,
  report_published: <FileText className="h-4 w-4" />,
  issue_flagged: <AlertTriangle className="h-4 w-4" />,
  milestone_completed: <Target className="h-4 w-4" />,
  user_joined: <UserPlus className="h-4 w-4" />,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  task_assigned: "text-blue-500 bg-blue-50",
  comment_added: "text-gray-500 bg-gray-100",
  report_published: "text-green-500 bg-green-50",
  issue_flagged: "text-red-500 bg-red-50",
  milestone_completed: "text-green-500 bg-green-50",
  user_joined: "text-amber-500 bg-amber-50",
};

function timeAgo(dateString: string): string {
  const now = new Date("2026-03-17T12:00:00Z"); // Use mock "now"
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications());
  const [readIds, setReadIds] = useState<Set<string>>(
    new Set(notifications.filter((n) => n.readAt).map((n) => n.id)),
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNotificationClick(notificationId: string) {
    setReadIds((prev) => new Set(prev).add(notificationId));
    setOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-gray-200 shadow-dropdown z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-400">{unreadCount} unread</span>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isRead = readIds.has(notification.id);
                const content = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer",
                      !isRead && "bg-blue-50/30",
                    )}
                    onClick={() => handleNotificationClick(notification.id)}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        TYPE_COLORS[notification.type],
                      )}
                    >
                      {TYPE_ICONS[notification.type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm truncate",
                            isRead ? "text-gray-700" : "text-gray-900 font-medium",
                          )}
                        >
                          {notification.title}
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                    </div>
                    {!isRead && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-green shrink-0" />
                    )}
                  </div>
                );

                return notification.href ? (
                  <Link key={notification.id} href={notification.href}>
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
