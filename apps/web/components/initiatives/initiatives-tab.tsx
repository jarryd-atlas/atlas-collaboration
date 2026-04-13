"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Users,
  CheckCircle2,
  ListTodo,
  Gavel,
  MessageSquare,
  X,
  Trash2,
  LinkIcon,
  Unlink,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/avatar";
import { PriorityBadge } from "../ui/badge";
import { Button } from "../ui/button";
import { InitiativeStatusBadge, INITIATIVE_STATUSES } from "./initiative-status-badge";
import {
  createInitiative,
  updateInitiative,
  deleteInitiative,
  linkTaskToInitiative,
  unlinkTaskFromInitiative,
  addInitiativeStakeholder,
  removeInitiativeStakeholder,
  createInitiativeDecision,
  deleteInitiativeDecision,
  fetchInitiativeDetail,
} from "../../lib/actions/initiatives";
import { createStakeholder } from "../../lib/actions/account-plan";
import { createComment } from "../../lib/actions/comments";
import { InlineTaskInput } from "../tasks/inline-task-input";
import { Search, UserPlus, Tag } from "lucide-react";
import { INITIATIVE_CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/constants/sales-intelligence";

// ─── Types ─────────────────────────────────────────────────

interface Initiative {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  owner_id: string;
  owner: { id: string; full_name: string; avatar_url: string | null; email: string } | null;
  taskCount: number;
  decisionCount: number;
  stakeholderCount: number;
}

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

interface Stakeholder {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  company: string | null;
  is_ck_internal: boolean;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
  due_date: string | null;
}

interface Decision {
  id: string;
  title: string;
  description: string | null;
  decided_at: string;
  author: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; full_name: string; avatar_url: string | null } | null;
}

interface InitiativeStakeholder {
  id: string;
  stakeholder_id: string;
  role: string | null;
  stakeholder: Stakeholder | null;
}

interface InitiativeDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  target_date: string | null;
  completed_at: string | null;
  tenant_id: string;
  customer_id: string;
  owner_id: string;
  owner: { id: string; full_name: string; avatar_url: string | null } | null;
  stakeholders: InitiativeStakeholder[];
  tasks: Task[];
  decisions: Decision[];
  comments: Comment[];
}

// ─── Props ─────────────────────────────────────────────────

interface InitiativesTabProps {
  initiatives: Initiative[];
  customerId: string;
  tenantId: string;
  accountPlanId?: string;
  assignableUsers: AssignableUser[];
  stakeholders: Stakeholder[];
  customerTasks: Task[];
  isCKInternal: boolean;
  currentUserName: string;
  currentUserAvatar?: string | null;
  profileId?: string;
}

// ─── Filter type ───────────────────────────────────────────

type StatusFilter = "all" | "active" | "on_hold" | "waiting" | "completed";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
];

// ─── Main Component ────────────────────────────────────────

export function InitiativesTab({
  initiatives,
  customerId,
  tenantId,
  accountPlanId,
  assignableUsers,
  stakeholders,
  customerTasks,
  isCKInternal,
  currentUserName,
  currentUserAvatar,
  profileId,
}: InitiativesTabProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InitiativeDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const router = useRouter();

  const filtered = initiatives.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (categoryFilter !== "all" && (i.category ?? "") !== categoryFilter) return false;
    return true;
  });

  const handleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setIsLoadingDetail(true);
    try {
      const data = await fetchInitiativeDetail(id);
      setDetail(data as InitiativeDetail | null);
    } catch {
      // show empty
    }
    setIsLoadingDetail(false);
  }, [expandedId]);

  return (
    <div className="overflow-y-auto h-full p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Initiatives</h2>
          <span className="text-sm text-gray-400">({filtered.length})</span>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Initiative
        </button>
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
              statusFilter === f.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="w-px h-4 bg-gray-200" />
        <button
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
            categoryFilter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All Types
        </button>
        {INITIATIVE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategoryFilter(c.key)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
              categoryFilter === c.key
                ? CATEGORY_COLORS[c.key] ?? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateInitiativeForm
          customerId={customerId}
          tenantId={tenantId}
          assignableUsers={assignableUsers}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Initiative list */}
      {filtered.length === 0 && !showCreateForm && (
        <div className="text-center py-12">
          <Rocket className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No initiatives yet</p>
          <p className="text-xs text-gray-400">
            Create an initiative to start tracking a workstream with your team.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((initiative) => (
          <div key={initiative.id}>
            {/* Initiative card */}
            <button
              onClick={() => handleExpand(initiative.id)}
              className={cn(
                "w-full text-left rounded-lg border p-4 transition-colors",
                expandedId === initiative.id
                  ? "border-gray-300 bg-white shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start gap-3">
                {expandedId === initiative.id ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{initiative.title}</span>
                    <InitiativeStatusBadge status={initiative.status} />
                    <PriorityBadge priority={initiative.priority} />
                    {initiative.category && CATEGORY_LABELS[initiative.category] && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        CATEGORY_COLORS[initiative.category] ?? "bg-gray-100 text-gray-600"
                      )}>
                        <Tag className="h-2.5 w-2.5" />
                        {CATEGORY_LABELS[initiative.category]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    {initiative.owner && (
                      <span className="flex items-center gap-1">
                        <Avatar
                          name={initiative.owner.full_name}
                          src={initiative.owner.avatar_url}
                          size="sm"
                        />
                        {initiative.owner.full_name}
                      </span>
                    )}
                    {initiative.target_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(initiative.target_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {initiative.taskCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ListTodo className="h-3 w-3" />
                        {initiative.taskCount} task{initiative.taskCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {initiative.decisionCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Gavel className="h-3 w-3" />
                        {initiative.decisionCount} decision{initiative.decisionCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {initiative.stakeholderCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {initiative.stakeholderCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded detail */}
            {expandedId === initiative.id && (
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden">
                {isLoadingDetail ? (
                  <div className="text-center py-8 text-xs text-gray-400">Loading...</div>
                ) : detail ? (
                  <InitiativeDetailPanel
                    detail={detail}
                    tenantId={tenantId}
                    customerId={customerId}
                    accountPlanId={accountPlanId}
                    assignableUsers={assignableUsers}
                    allStakeholders={stakeholders}
                    allTasks={customerTasks}
                    isCKInternal={isCKInternal}
                    currentUserName={currentUserName}
                    currentUserAvatar={currentUserAvatar}
                    profileId={profileId}
                    onClose={() => { setExpandedId(null); setDetail(null); }}
                    onRefresh={() => handleExpand(initiative.id)}
                  />
                ) : (
                  <div className="text-center py-8 text-xs text-gray-400">Unable to load details</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create Initiative Form ────────────────────────────────

function CreateInitiativeForm({
  customerId,
  tenantId,
  assignableUsers,
  onClose,
}: {
  customerId: string;
  tenantId: string;
  assignableUsers: AssignableUser[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const formData = new FormData();
    formData.set("customerId", customerId);
    formData.set("tenantId", tenantId);
    formData.set("title", title.trim());
    if (description) formData.set("description", description);
    formData.set("priority", priority);
    if (category) formData.set("category", category);
    if (ownerId) formData.set("ownerId", ownerId);
    if (targetDate) formData.set("targetDate", targetDate);

    startTransition(async () => {
      const result = await createInitiative(formData);
      if (result.success) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">New Initiative</h3>
        <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What are you working on?"
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none resize-none"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="">None</option>
            {INITIATIVE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Owner</label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="">Me</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

// ─── Initiative Detail Panel ───────────────────────────────

function InitiativeDetailPanel({
  detail,
  tenantId,
  customerId,
  accountPlanId,
  assignableUsers,
  allStakeholders,
  allTasks,
  isCKInternal,
  currentUserName,
  currentUserAvatar,
  profileId,
  onClose,
  onRefresh,
}: {
  detail: InitiativeDetail;
  tenantId: string;
  customerId: string;
  accountPlanId?: string;
  assignableUsers: AssignableUser[];
  allStakeholders: Stakeholder[];
  allTasks: Task[];
  isCKInternal: boolean;
  currentUserName: string;
  currentUserAvatar?: string | null;
  profileId?: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Editable fields
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? "");
  const [status, setStatus] = useState(detail.status);
  const [priority, setPriority] = useState(detail.priority);
  const [detailCategory, setDetailCategory] = useState(detail.category ?? "");
  const [ownerId, setOwnerId] = useState(detail.owner_id);
  const [targetDate, setTargetDate] = useState(detail.target_date ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);

  // Decision form
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState("");
  const [decisionDesc, setDecisionDesc] = useState("");

  // Task linking + creation
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");

  // Stakeholder linking
  const [showStakeholderPicker, setShowStakeholderPicker] = useState(false);
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonTitle, setNewPersonTitle] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");

  // Comments
  const [commentBody, setCommentBody] = useState("");

  const handleUpdate = useCallback(
    (data: Parameters<typeof updateInitiative>[1]) => {
      startTransition(async () => {
        await updateInitiative(detail.id, data);
        router.refresh();
        onRefresh();
      });
    },
    [detail.id, router, onRefresh]
  );

  const handleStatusChange = useCallback(
    (newStatus: string) => {
      setStatus(newStatus);
      handleUpdate({ status: newStatus });
    },
    [handleUpdate]
  );

  const handlePriorityChange = useCallback(
    (newPriority: string) => {
      setPriority(newPriority);
      handleUpdate({ priority: newPriority });
    },
    [handleUpdate]
  );

  const handleCategoryChange = useCallback(
    (newCategory: string) => {
      setDetailCategory(newCategory);
      handleUpdate({ category: newCategory || null });
    },
    [handleUpdate]
  );

  const handleOwnerChange = useCallback(
    (newOwnerId: string) => {
      setOwnerId(newOwnerId);
      handleUpdate({ owner_id: newOwnerId });
    },
    [handleUpdate]
  );

  const handleTargetDateChange = useCallback(
    (newDate: string) => {
      setTargetDate(newDate);
      handleUpdate({ target_date: newDate || null });
    },
    [handleUpdate]
  );

  const handleTitleSave = useCallback(() => {
    if (title.trim() && title !== detail.title) {
      handleUpdate({ title: title.trim() });
    }
    setEditingTitle(false);
  }, [title, detail.title, handleUpdate]);

  const handleDescSave = useCallback(() => {
    if (description !== (detail.description ?? "")) {
      handleUpdate({ description: description || null });
    }
    setEditingDesc(false);
  }, [description, detail.description, handleUpdate]);

  const handlePostComment = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!commentBody.trim()) return;

      const formData = new FormData();
      formData.set("entityType", "initiative");
      formData.set("entityId", detail.id);
      formData.set("body", commentBody.trim());
      formData.set("tenantId", tenantId);

      startTransition(async () => {
        await createComment(formData);
        setCommentBody("");
        router.refresh();
        onRefresh();
      });
    },
    [commentBody, detail.id, tenantId, router, onRefresh]
  );

  const handleAddDecision = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!decisionTitle.trim()) return;

      const formData = new FormData();
      formData.set("initiativeId", detail.id);
      formData.set("tenantId", tenantId);
      formData.set("title", decisionTitle.trim());
      if (decisionDesc) formData.set("description", decisionDesc);

      startTransition(async () => {
        await createInitiativeDecision(formData);
        setDecisionTitle("");
        setDecisionDesc("");
        setShowDecisionForm(false);
        router.refresh();
        onRefresh();
      });
    },
    [decisionTitle, decisionDesc, detail.id, tenantId, router, onRefresh]
  );

  const handleLinkTask = useCallback(
    (taskId: string) => {
      startTransition(async () => {
        await linkTaskToInitiative(detail.id, taskId);
        router.refresh();
        onRefresh();
      });
    },
    [detail.id, router, onRefresh]
  );

  const handleUnlinkTask = useCallback(
    (taskId: string) => {
      startTransition(async () => {
        await unlinkTaskFromInitiative(detail.id, taskId);
        router.refresh();
        onRefresh();
      });
    },
    [detail.id, router, onRefresh]
  );

  const handleAddStakeholder = useCallback(
    (stakeholderId: string) => {
      startTransition(async () => {
        await addInitiativeStakeholder(detail.id, stakeholderId);
        router.refresh();
        onRefresh();
      });
    },
    [detail.id, router, onRefresh]
  );

  const handleRemoveStakeholder = useCallback(
    (stakeholderId: string) => {
      startTransition(async () => {
        await removeInitiativeStakeholder(detail.id, stakeholderId);
        router.refresh();
        onRefresh();
      });
    },
    [detail.id, router, onRefresh]
  );

  const handleCreateAndLinkStakeholder = useCallback(
    (name: string, title: string, email: string) => {
      if (!accountPlanId || !name.trim()) return;
      startTransition(async () => {
        const result = await createStakeholder(accountPlanId, tenantId, {
          name: name.trim(),
          title: title.trim() || undefined,
          email: email.trim() || undefined,
        });
        if (result && "id" in result && result.id) {
          await addInitiativeStakeholder(detail.id, result.id);
        }
        router.refresh();
        onRefresh();
      });
    },
    [accountPlanId, tenantId, detail.id, router, onRefresh]
  );

  const handleDelete = useCallback(() => {
    if (!confirm("Delete this initiative? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteInitiative(detail.id);
      onClose();
      router.refresh();
    });
  }, [detail.id, onClose, router]);

  // Tasks not yet linked
  const linkedTaskIds = new Set(detail.tasks.map((t) => t.id));
  const availableTasks = allTasks.filter((t) => !linkedTaskIds.has(t.id));

  // Stakeholders not yet linked
  const linkedStakeholderIds = new Set(detail.stakeholders.map((s) => s.stakeholder_id));
  const availableStakeholders = allStakeholders.filter((s) => !linkedStakeholderIds.has(s.id));

  return (
    <div className="divide-y divide-gray-200">
      {/* Header section */}
      <div className="p-4 space-y-3">
        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") { setTitle(detail.title); setEditingTitle(false); } }}
            className="w-full text-base font-bold text-gray-900 border border-gray-200 rounded px-2 py-1 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none"
          />
        ) : (
          <h3
            onClick={() => setEditingTitle(true)}
            className="text-base font-bold text-gray-900 cursor-text hover:bg-gray-100 rounded px-1 py-0.5 -mx-1"
          >
            {title}
          </h3>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium"
          >
            {INITIATIVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <select
            value={detailCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
          >
            <option value="">No Category</option>
            {INITIATIVE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          <select
            value={ownerId}
            onChange={(e) => handleOwnerChange(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
          >
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>

          <input
            type="date"
            value={targetDate}
            onChange={(e) => handleTargetDateChange(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs"
          />

          {isCKInternal && (
            <button
              onClick={handleDelete}
              className="ml-auto p-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete initiative"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Description */}
        {editingDesc ? (
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescSave}
            rows={3}
            placeholder="Add a description..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none resize-none"
          />
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            className={cn(
              "text-sm cursor-text rounded px-1 py-0.5 -mx-1 hover:bg-gray-100",
              description ? "text-gray-700" : "text-gray-400 italic"
            )}
          >
            {description || "Add a description..."}
          </p>
        )}
      </div>

      {/* Stakeholders */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            People
          </h4>
          <div className="flex items-center gap-1">
            {accountPlanId && (
              <button
                onClick={() => { setShowNewPersonForm(!showNewPersonForm); setShowStakeholderPicker(false); }}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title="Add a new person to this company"
              >
                <UserPlus className="h-3 w-3" /> New
              </button>
            )}
            <button
              onClick={() => { setShowStakeholderPicker(!showStakeholderPicker); setShowNewPersonForm(false); setStakeholderSearch(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </div>

        {detail.stakeholders.length === 0 && !showStakeholderPicker && !showNewPersonForm && (
          <p className="text-xs text-gray-400">No stakeholders added yet.</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {detail.stakeholders.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 pl-2 pr-1 py-0.5 text-xs text-gray-700"
            >
              {s.stakeholder?.name ?? "Unknown"}
              {s.role && (
                <span className="text-[10px] text-gray-400">({s.role})</span>
              )}
              <button
                onClick={() => handleRemoveStakeholder(s.stakeholder_id)}
                className="p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>

        {/* Searchable stakeholder picker */}
        {showStakeholderPicker && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={stakeholderSearch}
                onChange={(e) => setStakeholderSearch(e.target.value)}
                placeholder="Search people..."
                className="w-full pl-7 pr-3 py-2 text-xs border-b border-gray-100 focus:outline-none focus:ring-0"
              />
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
              {(() => {
                const q = stakeholderSearch.toLowerCase();
                const filtered = availableStakeholders.filter(
                  (s) =>
                    !q ||
                    s.name.toLowerCase().includes(q) ||
                    s.title?.toLowerCase().includes(q) ||
                    s.email?.toLowerCase().includes(q) ||
                    s.company?.toLowerCase().includes(q)
                );
                if (filtered.length === 0) {
                  return (
                    <div className="p-2 text-xs text-gray-400">
                      {availableStakeholders.length === 0
                        ? "All people are already added."
                        : "No matches found."}
                      {accountPlanId && (
                        <button
                          onClick={() => {
                            setShowStakeholderPicker(false);
                            setShowNewPersonForm(true);
                            setNewPersonName(stakeholderSearch);
                            setStakeholderSearch("");
                          }}
                          className="ml-1 text-brand-green hover:underline"
                        >
                          Create new person
                        </button>
                      )}
                    </div>
                  );
                }
                return filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      handleAddStakeholder(s.id);
                      setStakeholderSearch("");
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>
                      <span className="font-medium text-gray-900">{s.name}</span>
                      {s.title && <span className="text-gray-400 ml-1">- {s.title}</span>}
                    </span>
                    {s.is_ck_internal && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">CK</span>
                    )}
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Create new person inline form */}
        {showNewPersonForm && accountPlanId && (
          <div className="border border-gray-200 rounded-md bg-white p-3 space-y-2">
            <p className="text-xs font-medium text-gray-700">Add New Person</p>
            <input
              autoFocus
              type="text"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="Name *"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
            <input
              type="text"
              value={newPersonTitle}
              onChange={(e) => setNewPersonTitle(e.target.value)}
              placeholder="Title (e.g. VP Operations)"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
            <input
              type="email"
              value={newPersonEmail}
              onChange={(e) => setNewPersonEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  handleCreateAndLinkStakeholder(newPersonName, newPersonTitle, newPersonEmail);
                  setNewPersonName("");
                  setNewPersonTitle("");
                  setNewPersonEmail("");
                  setShowNewPersonForm(false);
                }}
                disabled={!newPersonName.trim() || isPending}
                className="px-3 py-1.5 text-xs font-medium text-white bg-brand-green rounded-md hover:bg-brand-green/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Adding..." : "Add Person"}
              </button>
              <button
                onClick={() => {
                  setShowNewPersonForm(false);
                  setNewPersonName("");
                  setNewPersonTitle("");
                  setNewPersonEmail("");
                }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Decisions */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Gavel className="h-3.5 w-3.5" />
            Decisions ({detail.decisions.length})
          </h4>
          <button
            onClick={() => setShowDecisionForm(!showDecisionForm)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Record
          </button>
        </div>

        {showDecisionForm && (
          <form onSubmit={handleAddDecision} className="space-y-2 bg-white border border-gray-200 rounded-md p-3">
            <input
              autoFocus
              value={decisionTitle}
              onChange={(e) => setDecisionTitle(e.target.value)}
              placeholder="What was decided?"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-gray-400 outline-none"
            />
            <textarea
              value={decisionDesc}
              onChange={(e) => setDecisionDesc(e.target.value)}
              placeholder="Context or rationale (optional)"
              rows={2}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-gray-400 outline-none resize-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowDecisionForm(false)} className="text-xs text-gray-500">Cancel</button>
              <button type="submit" disabled={!decisionTitle.trim() || isPending} className="text-xs font-medium text-white bg-gray-900 rounded px-2.5 py-1 disabled:opacity-50">
                Record
              </button>
            </div>
          </form>
        )}

        {detail.decisions.length === 0 && !showDecisionForm && (
          <p className="text-xs text-gray-400">No decisions recorded yet.</p>
        )}

        <div className="space-y-2">
          {detail.decisions.map((d) => (
            <div key={d.id} className="bg-white border border-gray-100 rounded-md p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.title}</p>
                  {d.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {d.author?.full_name ?? "Unknown"} &middot;{" "}
                    {new Date(d.decided_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {isCKInternal && (
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        await deleteInitiativeDecision(d.id);
                        router.refresh();
                        onRefresh();
                      });
                    }}
                    className="p-1 text-gray-300 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Items (Tasks) */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <ListTodo className="h-3.5 w-3.5" />
            Action Items ({detail.tasks.length})
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowNewTaskForm(!showNewTaskForm); setShowTaskPicker(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> New Task
            </button>
            <button
              onClick={() => { setShowTaskPicker(!showTaskPicker); setShowNewTaskForm(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <LinkIcon className="h-3 w-3" /> Link Existing
            </button>
          </div>
        </div>

        {/* Inline new task form with @ mentions */}
        {showNewTaskForm && (
          <InlineTaskInput
            customerId={customerId}
            tenantId={tenantId}
            initiativeId={detail.id}
            assignableUsers={assignableUsers}
            placeholder="Type a task and press Enter... Use @ to assign"
            autoFocus
            showAiExpand={false}
            onTaskCreated={() => {
              onRefresh();
            }}
          />
        )}

        {showTaskPicker && (
          <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-7 pr-3 py-2 text-xs border-b border-gray-100 focus:outline-none focus:ring-0"
              />
            </div>
            <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
              {(() => {
                const q = taskSearch.toLowerCase();
                const filtered = availableTasks.filter(
                  (t) => !q || t.title.toLowerCase().includes(q) || t.assignee?.full_name.toLowerCase().includes(q)
                );
                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-gray-400 p-2">
                      {availableTasks.length === 0 ? "No available tasks to link." : "No matches found."}
                    </p>
                  );
                }
                return filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { handleLinkTask(t.id); setTaskSearch(""); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                  >
                    <TaskStatusIcon status={t.status} />
                    <span className="flex-1 truncate text-gray-900">{t.title}</span>
                    {t.assignee && (
                      <Avatar name={t.assignee.full_name} src={t.assignee.avatar_url} size="sm" />
                    )}
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {detail.tasks.length === 0 && !showTaskPicker && (
          <p className="text-xs text-gray-400">No tasks linked yet.</p>
        )}

        <div className="space-y-1">
          {detail.tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white group"
            >
              <TaskStatusIcon status={t.status} />
              <span className={cn(
                "flex-1 text-sm truncate",
                t.status === "done" ? "text-gray-400 line-through" : "text-gray-900"
              )}>
                {t.title}
              </span>
              {t.assignee && (
                <Avatar name={t.assignee.full_name} src={t.assignee.avatar_url} size="sm" />
              )}
              <button
                onClick={() => handleUnlinkTask(t.id)}
                className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Unlink task"
              >
                <Unlink className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Discussion (Comments) */}
      <div className="p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Discussion ({detail.comments.length})
        </h4>

        {detail.comments.length === 0 && (
          <p className="text-xs text-gray-400">No comments yet. Start the discussion below.</p>
        )}

        <div className="space-y-3">
          {detail.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar
                name={c.author?.full_name ?? "Unknown"}
                src={c.author?.avatar_url}
                size="sm"
                className="shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-gray-900">
                    {c.author?.full_name ?? "Unknown"}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(c.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comment input */}
        <form onSubmit={handlePostComment} className="flex items-start gap-2.5">
          <Avatar name={currentUserName} src={currentUserAvatar} size="sm" className="mt-1 shrink-0" />
          <div className="flex-1">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none resize-none"
            />
            <div className="flex justify-end mt-1.5">
              <button
                type="submit"
                disabled={!commentBody.trim() || isPending}
                className="px-3 py-1 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {isPending ? "Posting..." : "Post"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  if (status === "done") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  }
  const colors: Record<string, string> = {
    todo: "border-gray-300",
    in_progress: "border-blue-400 bg-blue-50",
    in_review: "border-amber-400 bg-amber-50",
  };
  return (
    <div className={cn("h-3.5 w-3.5 rounded-full border-2 shrink-0", colors[status] ?? "border-gray-300")} />
  );
}
