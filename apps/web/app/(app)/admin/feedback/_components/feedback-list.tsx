"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../../components/ui/button";
import { updateFeedbackStatus, type FeedbackRow, type FeedbackStatus } from "../../../../../lib/actions/feedback";
import { MessageSquare, Bug, Lightbulb, TrendingUp, HelpCircle, ExternalLink } from "lucide-react";

interface FeedbackListProps {
  initialFeedback: FeedbackRow[];
}

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "planned", label: "Planned" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismissed" },
];

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  reviewed: "bg-yellow-50 text-yellow-700 border-yellow-200",
  planned: "bg-purple-50 text-purple-700 border-purple-200",
  done: "bg-green-50 text-green-700 border-green-200",
  dismissed: "bg-gray-50 text-gray-400 border-gray-200",
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  bug: <Bug className="h-4 w-4 text-red-500" />,
  feature_request: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  improvement: <TrendingUp className="h-4 w-4 text-blue-500" />,
  other: <HelpCircle className="h-4 w-4 text-gray-400" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature_request: "Feature Request",
  improvement: "Improvement",
  other: "Other",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function FeedbackList({ initialFeedback }: FeedbackListProps) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = filter === "all" ? feedback : feedback.filter((f) => f.status === filter);

  const counts = feedback.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  function handleStatusChange(id: string, newStatus: FeedbackStatus) {
    setUpdatingId(id);
    startTransition(async () => {
      const result = await updateFeedbackStatus(id, newStatus);
      if ("success" in result) {
        setFeedback((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f))
        );
      }
      setUpdatingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            filter === "all"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          All ({feedback.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filter === s.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s.label} ({counts[s.value] || 0})
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center shadow-card">
          <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {filter === "all" ? "No feedback submitted yet." : `No ${filter} feedback.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-100 p-5 shadow-card"
            >
              <div className="flex items-start gap-4">
                {/* Category icon */}
                <div className="mt-0.5">{CATEGORY_ICON[item.category]}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-medium text-gray-500">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                    {item.submitter_name && (
                      <span>
                        by <span className="text-gray-600 font-medium">{item.submitter_name}</span>
                      </span>
                    )}
                    {item.page_url && (
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {item.page_url}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status dropdown */}
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                  disabled={updatingId === item.id}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
