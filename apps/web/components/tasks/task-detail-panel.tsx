"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SlidePanel, SlidePanelBody } from "../ui/slide-panel";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { InlineEditableTitle } from "./inline-editable-title";
import { PriorityBadge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Calendar, MessageSquare, X } from "lucide-react";
import { getTaskComments, createComment } from "../../lib/actions";

interface TaskForPanel {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description?: string | null;
  assignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

interface TaskDetailPanelProps {
  task: TaskForPanel | null;
  open: boolean;
  onClose: () => void;
  tenantId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
}

export function TaskDetailPanel({
  task,
  open,
  onClose,
  tenantId,
  currentUserName,
  currentUserAvatar,
}: TaskDetailPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [isPosting, startPosting] = useTransition();
  const router = useRouter();

  // Fetch comments when panel opens
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
    if (open && task) {
      fetchComments();
    }
    if (!open) {
      setComments([]);
      setCommentBody("");
    }
  }, [open, task, fetchComments]);

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

  if (!task) return null;

  return (
    <SlidePanel open={open} onClose={onClose} width="max-w-md">
      {/* Editable header */}
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <InlineEditableTitle
              taskId={task.id}
              initialTitle={task.title}
              className="text-base font-bold"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 mt-0.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      <SlidePanelBody>
        {/* Task metadata (assignee, due date) */}
        {(task.assignee?.full_name || task.due_date) && (
          <div className="px-6 py-4 border-b border-gray-100 space-y-3">
            {task.assignee?.full_name && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-14">Assignee</span>
                <div className="flex items-center gap-1.5">
                  <Avatar name={task.assignee.full_name} src={task.assignee.avatar_url} size="sm" />
                  <span className="text-sm text-gray-700">{task.assignee.full_name}</span>
                </div>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-14">Due</span>
                <span className="text-sm text-gray-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  {task.due_date}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Updates / Comments */}
        <div className="px-6 py-4">
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

        {/* Comment input — pinned at bottom */}
        <div className="px-6 py-4 border-t border-gray-100 mt-auto shrink-0">
          <form onSubmit={handlePostComment} className="flex items-start gap-3">
            <Avatar name={currentUserName} src={currentUserAvatar} size="sm" className="mt-1" />
            <div className="flex-1">
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add an update..."
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
      </SlidePanelBody>
    </SlidePanel>
  );
}
