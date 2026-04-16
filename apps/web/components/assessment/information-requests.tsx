"use client";

import { useState, useTransition, useEffect } from "react";
import { MessageSquarePlus, ChevronDown, ChevronRight, CheckCircle2, Clock, AlertCircle, Send, X, Plus } from "lucide-react";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import {
  createInformationRequest,
  updateInformationRequestStatus,
  markRequestResponded,
} from "../../lib/actions/discovery";
import { createComment } from "../../lib/actions";
import { DISCOVERY_SECTION_LABELS } from "@repo/shared";
import type { DiscoverySection } from "@repo/shared";

// ─── Types ────────────────────────────────────────────────

interface InfoRequest {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "responded" | "resolved";
  priority: string;
  section_key: string | null;
  created_at: string;
  requester?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

interface InformationRequestsProps {
  requests: InfoRequest[];
  siteId: string;
  tenantId: string;
  isInternal: boolean;
  assignableUsers: AssignableUser[];
  currentUserName: string;
  currentUserAvatar?: string | null;
}

// ─── Status helpers ──────────────────────────────────────

const STATUS_CONFIG = {
  open: { label: "Open", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
  responded: { label: "Responded", icon: Clock, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", ring: "ring-green-200" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  urgent: "text-red-600",
};

// ─── Main Component ──────────────────────────────────────

export function InformationRequests({
  requests,
  siteId,
  tenantId,
  isInternal,
  assignableUsers,
  currentUserName,
  currentUserAvatar,
}: InformationRequestsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");

  const openCount = requests.filter((r) => r.status === "open").length;
  const respondedCount = requests.filter((r) => r.status === "responded").length;

  const filtered = filter === "all"
    ? requests
    : filter === "open"
      ? requests.filter((r) => r.status !== "resolved")
      : requests.filter((r) => r.status === "resolved");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Information Requests
          </h2>
          {openCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              {openCount} open
            </span>
          )}
          {respondedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
              {respondedCount} responded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value="all">All ({requests.length})</option>
            <option value="open">Active ({requests.filter((r) => r.status !== "resolved").length})</option>
            <option value="resolved">Resolved ({requests.filter((r) => r.status === "resolved").length})</option>
          </select>

          {isInternal && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Request
            </Button>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && isInternal && (
        <CreateRequestForm
          siteId={siteId}
          tenantId={tenantId}
          assignableUsers={assignableUsers}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Request list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          {requests.length === 0
            ? "No information requests yet"
            : "No requests match this filter"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              isExpanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              isInternal={isInternal}
              tenantId={tenantId}
              currentUserName={currentUserName}
              currentUserAvatar={currentUserAvatar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateRequestForm({
  siteId,
  tenantId,
  assignableUsers,
  onClose,
}: {
  siteId: string;
  tenantId: string;
  assignableUsers: AssignableUser[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [sectionKey, setSectionKey] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      const result = await createInformationRequest({
        siteId,
        tenantId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        sectionKey: sectionKey || undefined,
        assignedTo: assignedTo || undefined,
      });
      if (result.success) {
        onClose();
      }
    });
  }

  const sectionOptions = Object.entries(DISCOVERY_SECTION_LABELS) as [DiscoverySection, string][];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">New Information Request</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What do you need? e.g., 'Utility bills for Jan-Mar 2025'"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
        autoFocus
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Add details (optional)..."
        rows={2}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as any)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
          <option value="urgent">Urgent</option>
        </select>

        <select
          value={sectionKey}
          onChange={(e) => setSectionKey(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green"
        >
          <option value="">No section link</option>
          {sectionOptions.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-green"
        >
          <option value="">Assign to...</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name}{u.group ? ` (${u.group})` : ""}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!title.trim() || isPending}>
          {isPending ? "Creating..." : "Create Request"}
        </Button>
      </div>
    </form>
  );
}

// ─── Request Card ────────────────────────────────────────

function RequestCard({
  request,
  isExpanded,
  onToggle,
  isInternal,
  tenantId,
  currentUserName,
  currentUserAvatar,
}: {
  request: InfoRequest;
  isExpanded: boolean;
  onToggle: () => void;
  isInternal: boolean;
  tenantId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
}) {
  const config = STATUS_CONFIG[request.status];
  const StatusIcon = config.icon;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load comments when expanded
  useEffect(() => {
    if (isExpanded && comments.length === 0) {
      setLoadingComments(true);
      fetch(`/api/info-requests/${request.id}/comments`)
        .then((r) => r.json())
        .then((data) => setComments(data.comments ?? []))
        .catch(() => {})
        .finally(() => setLoadingComments(false));
    }
  }, [isExpanded, request.id, comments.length]);

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;

    const formData = new FormData();
    formData.set("entityType", "info_request");
    formData.set("entityId", request.id);
    formData.set("body", replyBody.trim());
    formData.set("tenantId", tenantId);

    startTransition(async () => {
      const result = await createComment(formData);
      if (result && "success" in result) {
        setComments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            body: replyBody.trim(),
            created_at: new Date().toISOString(),
            author: { id: "", full_name: currentUserName, avatar_url: currentUserAvatar ?? null },
          },
        ]);
        setReplyBody("");
        // If customer is replying to an open request, mark as responded
        if (!isInternal && request.status === "open") {
          await markRequestResponded(request.id);
        }
      }
    });
  }

  function handleStatusChange(newStatus: "open" | "responded" | "resolved") {
    startTransition(async () => {
      await updateInformationRequestStatus(request.id, newStatus);
    });
  }

  const sectionLabel = request.section_key
    ? DISCOVERY_SECTION_LABELS[request.section_key as DiscoverySection]
    : null;

  return (
    <div className={`rounded-xl border ${request.status === "resolved" ? "border-gray-100 bg-gray-50/50" : "border-gray-200 bg-white"} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}

        <StatusIcon className={`h-4 w-4 shrink-0 ${config.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${request.status === "resolved" ? "text-gray-500 line-through" : "text-gray-900"}`}>
              {request.title}
            </span>
            {sectionLabel && (
              <span className="text-[10px] rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500">
                {sectionLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
            <span>{request.requester?.full_name ?? "Unknown"}</span>
            <span>·</span>
            <span>{formatRelativeTime(request.created_at)}</span>
            {request.assignee && (
              <>
                <span>·</span>
                <span>Assigned to {request.assignee.full_name}</span>
              </>
            )}
          </div>
        </div>

        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color} ring-1 ${config.ring}`}>
          {config.label}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Description */}
          {request.description && (
            <div className="px-4 py-3 text-sm text-gray-600 bg-gray-50/30">
              {request.description}
            </div>
          )}

          {/* Status actions (CK only) */}
          {isInternal && request.status !== "resolved" && (
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
              <span className="text-xs text-gray-400">Actions:</span>
              {request.status === "open" && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("responded")}
                  disabled={isPending}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark Responded
                </button>
              )}
              <button
                type="button"
                onClick={() => handleStatusChange("resolved")}
                disabled={isPending}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Resolve
              </button>
              {request.status !== "open" && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("open")}
                  disabled={isPending}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Reopen
                </button>
              )}
            </div>
          )}

          {/* Comment thread */}
          <div className="px-4 py-3 space-y-3">
            {loadingComments ? (
              <p className="text-xs text-gray-400">Loading replies...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400">No replies yet</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2">
                  <Avatar
                    name={comment.author?.full_name ?? "?"}
                    src={comment.author?.avatar_url}
                    size="xs"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">
                        {comment.author?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply form */}
          {request.status !== "resolved" && (
            <form onSubmit={handleReply} className="px-4 py-3 border-t border-gray-100 flex items-start gap-2">
              <Avatar name={currentUserName} src={currentUserAvatar} size="xs" />
              <div className="flex-1">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Reply..."
                  rows={1}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleReply(e);
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!replyBody.trim() || isPending}
                className="p-1.5 rounded-lg text-brand-green hover:bg-brand-green/10 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors mt-0.5"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
