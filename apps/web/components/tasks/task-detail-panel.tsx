"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { SlidePanel } from "../ui/slide-panel";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { InlineEditableTitle } from "./inline-editable-title";
import { PriorityBadge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Calendar, MessageSquare, X, User, Search, Check, FileText, Building2, MapPin, Trash2 } from "lucide-react";
import {
  getTaskComments,
  createComment,
  updateTaskAssignee,
  updateTaskDueDate,
  updateTaskDescription,
  updateTaskCustomer,
  updateTaskSite,
  deleteTask,
} from "../../lib/actions";
import { cn } from "../../lib/utils";

export interface TaskForPanel {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description?: string | null;
  assignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
  customerInfo?: { name: string; slug: string } | null;
  siteInfo?: { name: string; slug: string } | null;
  customer_id?: string | null;
  site_id?: string | null;
}

interface SimplePickerItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

interface TaskDetailInlineProps {
  task: TaskForPanel;
  onClose: () => void;
  tenantId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  assignableUsers?: AssignableUser[];
  assignableCustomers?: SimplePickerItem[];
  assignableSites?: SimplePickerItem[];
  onTaskUpdated?: (updates: Partial<TaskForPanel>) => void;
}

// ─── Searchable Picker (reusable) ─────────────────────────

function InlinePicker({
  icon,
  label,
  selectedName,
  items,
  onSelect,
  placeholder,
  searchPlaceholder,
  renderItem,
}: {
  icon: React.ReactNode;
  label: string;
  selectedName: string | null;
  items: SimplePickerItem[];
  onSelect: (id: string | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  renderItem?: (item: SimplePickerItem, isSelected: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex items-center gap-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 -mx-2 transition-colors"
      >
        {icon}
        <span className={selectedName ? "text-gray-700" : "text-gray-400"}>
          {selectedName ?? placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-16 top-full w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[240px] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder ?? "Search..."}
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-400 italic",
                !selectedName && "bg-gray-50",
              )}
            >
              None
            </button>
            {filtered.map((item) => {
              const isSelected = item.name === selectedName;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onSelect(item.id); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2",
                    isSelected && "bg-brand-green/5",
                  )}
                >
                  {renderItem ? renderItem(item, isSelected) : (
                    <>
                      <span className="flex-1 truncate text-gray-900">{item.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-brand-green shrink-0" />}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Task Detail Inline ───────────────────────────────────

export function TaskDetailInline({
  task,
  onClose,
  tenantId,
  currentUserName,
  currentUserAvatar,
  assignableUsers = [],
  assignableCustomers = [],
  assignableSites = [],
  onTaskUpdated,
}: TaskDetailInlineProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [isPosting, startPosting] = useTransition();
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Local state for optimistic updates
  const [localAssignee, setLocalAssignee] = useState(task.assignee);
  const [localCustomerName, setLocalCustomerName] = useState(task.customerInfo?.name ?? null);
  const [localSiteName, setLocalSiteName] = useState(task.siteInfo?.name ?? null);

  // Description editing
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(task.description ?? "");
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Due date
  const [dueDate, setDueDate] = useState(task.due_date ?? "");

  // Sync state when task changes
  useEffect(() => {
    setDescValue(task.description ?? "");
    setDueDate(task.due_date ?? "");
    setLocalAssignee(task.assignee);
    setLocalCustomerName(task.customerInfo?.name ?? null);
    setLocalSiteName(task.siteInfo?.name ?? null);
  }, [task.id, task.description, task.due_date, task.assignee, task.customerInfo, task.siteInfo]);

  const fetchComments = useCallback(async () => {
    if (!task) return;
    setIsLoading(true);
    const result = await getTaskComments(task.id);
    if (result && "data" in result) {
      setComments(result.data as Comment[]);
    }
    setIsLoading(false);
  }, [task]);

  useEffect(() => {
    if (task) {
      fetchComments();
    }
    return () => {
      setComments([]);
      setCommentBody("");
    };
  }, [task, fetchComments]);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !editingDesc) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, editingDesc]);

  function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || !task) return;

    const formData = new FormData();
    formData.set("entityType", "task");
    formData.set("entityId", task.id);
    formData.set("body", commentBody.trim());
    if (tenantId) formData.set("tenantId", tenantId);

    startPosting(async () => {
      const result = await createComment(formData);
      if (!result || !("error" in result)) {
        setCommentBody("");
        await fetchComments();
        router.refresh();
      }
    });
  }

  function handleAssigneeChange(userId: string | null) {
    // Optimistic update
    const user = userId ? assignableUsers.find((u) => u.id === userId) : null;
    setLocalAssignee(user ? { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url } : null);
    onTaskUpdated?.({ assignee: user ? { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url } : null });

    startTransition(async () => {
      await updateTaskAssignee(task.id, userId);
      router.refresh();
    });
  }

  function handleDueDateChange(date: string) {
    setDueDate(date);
    onTaskUpdated?.({ due_date: date || null });
    startTransition(async () => {
      await updateTaskDueDate(task.id, date || null);
      router.refresh();
    });
  }

  function handleDescriptionSave() {
    const trimmed = descValue.trim();
    setEditingDesc(false);
    if (trimmed === (task.description ?? "").trim()) return;
    onTaskUpdated?.({ description: trimmed || null });
    startTransition(async () => {
      await updateTaskDescription(task.id, trimmed || null);
      router.refresh();
    });
  }

  function handleCustomerChange(customerId: string | null) {
    const customer = customerId ? assignableCustomers.find((c) => c.id === customerId) : null;
    setLocalCustomerName(customer?.name ?? null);
    onTaskUpdated?.({ customerInfo: customer ? { name: customer.name, slug: "" } : null });

    startTransition(async () => {
      await updateTaskCustomer(task.id, customerId);
      router.refresh();
    });
  }

  function handleSiteChange(siteId: string | null) {
    const site = siteId ? assignableSites.find((s) => s.id === siteId) : null;
    setLocalSiteName(site?.name ?? null);
    onTaskUpdated?.({ siteInfo: site ? { name: site.name, slug: "" } : null });

    startTransition(async () => {
      await updateTaskSite(task.id, siteId);
      router.refresh();
    });
  }

  // Build assignee picker items from assignableUsers
  const assigneeItems: SimplePickerItem[] = assignableUsers.map((u) => ({
    id: u.id,
    name: u.full_name,
    avatar_url: u.avatar_url,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <InlineEditableTitle
              taskId={task.id}
              initialTitle={task.title}
              className="text-base font-bold"
              singleClickEdit
            />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this task? This cannot be undone.")) {
                startTransition(async () => {
                  await deleteTask(task.id);
                  onClose();
                  router.refresh();
                });
              }
            }}
            className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Task metadata */}
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          {/* Assignee */}
          <InlinePicker
            icon={
              localAssignee ? (
                <Avatar name={localAssignee.full_name} src={localAssignee.avatar_url} size="sm" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <User className="h-3 w-3 text-gray-400" />
                </div>
              )
            }
            label="Assignee"
            selectedName={localAssignee?.full_name ?? null}
            items={assigneeItems}
            onSelect={handleAssigneeChange}
            placeholder="Unassigned"
            searchPlaceholder="Search team..."
            renderItem={(item, isSelected) => (
              <>
                <Avatar name={item.name} src={item.avatar_url} size="sm" />
                <span className="flex-1 truncate text-gray-900">{item.name}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-brand-green shrink-0" />}
              </>
            )}
          />

          {/* Due date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-16 shrink-0">Due</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className={cn(
                  "text-sm border-0 outline-none bg-transparent cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 transition-colors",
                  dueDate ? "text-gray-700" : "text-gray-400",
                )}
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => handleDueDateChange("")}
                  className="text-gray-300 hover:text-gray-500 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Customer */}
          <InlinePicker
            icon={<Building2 className="h-3.5 w-3.5 text-gray-400" />}
            label="Customer"
            selectedName={localCustomerName}
            items={assignableCustomers}
            onSelect={handleCustomerChange}
            placeholder="None"
            searchPlaceholder="Search customers..."
          />

          {/* Site */}
          <InlinePicker
            icon={<MapPin className="h-3.5 w-3.5 text-gray-400" />}
            label="Site"
            selectedName={localSiteName}
            items={assignableSites}
            onSelect={handleSiteChange}
            placeholder="None"
            searchPlaceholder="Search sites..."
          />
        </div>

        {/* Description */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Description</span>
          </div>
          {editingDesc ? (
            <div>
              <textarea
                ref={descRef}
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={handleDescriptionSave}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setDescValue(task.description ?? "");
                    setEditingDesc(false);
                  }
                }}
                rows={4}
                autoFocus
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
                placeholder="Add a description..."
              />
              <p className="text-[10px] text-gray-400 mt-1">Click outside or press Escape to finish</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingDesc(true);
                requestAnimationFrame(() => descRef.current?.focus());
              }}
              className="w-full text-left text-sm text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-2 -mx-3 transition-colors min-h-[40px]"
            >
              {task.description ? (
                <span className="whitespace-pre-wrap">{task.description}</span>
              ) : (
                <span className="text-gray-400 italic">Add a description...</span>
              )}
            </button>
          )}
        </div>

        {/* Comments */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Updates</h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              {comments.length}
            </span>
          </div>

          {isLoading ? (
            <div className="text-xs text-gray-400 text-center py-6">Loading updates...</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-6">
              No updates yet. Add one below.
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar
                    name={comment.author?.full_name ?? "Unknown"}
                    src={comment.author?.avatar_url}
                    size="sm"
                    className="shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-900">
                        {comment.author?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment input — pinned at bottom */}
      <div className="px-5 py-4 border-t border-gray-100 shrink-0">
        <form onSubmit={handlePostComment} className="flex items-start gap-3">
          <Avatar name={currentUserName} src={currentUserAvatar} size="sm" className="mt-1" />
          <div className="flex-1">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handlePostComment(e);
                }
              }}
              placeholder="Add an update... (Cmd+Enter to post)"
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
            />
            <div className="flex justify-end mt-2">
              <Button type="submit" size="sm" disabled={!commentBody.trim() || isPosting}>
                {isPosting ? "Posting..." : "Post Update"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TaskDetailPanelProps {
  task: TaskForPanel | null;
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  assignableUsers?: AssignableUser[];
  assignableCustomers?: SimplePickerItem[];
  assignableSites?: SimplePickerItem[];
  onTaskUpdated?: (updates: Partial<TaskForPanel>) => void;
}

/**
 * SlidePanel wrapper for TaskDetailInline.
 */
export function TaskDetailPanel({
  task,
  open,
  onClose,
  tenantId,
  currentUserName,
  currentUserAvatar,
  assignableUsers = [],
  assignableCustomers = [],
  assignableSites = [],
  onTaskUpdated,
}: TaskDetailPanelProps) {
  if (!task) return null;

  return (
    <SlidePanel open={open} onClose={onClose} width="max-w-md">
      <TaskDetailInline
        task={task}
        onClose={onClose}
        tenantId={tenantId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        assignableUsers={assignableUsers}
        assignableCustomers={assignableCustomers}
        assignableSites={assignableSites}
        onTaskUpdated={onTaskUpdated}
      />
    </SlidePanel>
  );
}
