"use client";

import { useState, useTransition } from "react";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { createComment } from "../../lib/actions";

interface CommentInputProps {
  currentUserName: string;
  currentUserAvatar?: string | null;
  entityType: string;
  entityId: string;
  tenantId?: string;
}

export function CommentInput({
  currentUserName,
  currentUserAvatar,
  entityType,
  entityId,
  tenantId,
}: CommentInputProps) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;

    const formData = new FormData();
    formData.set("entityType", entityType);
    formData.set("entityId", entityId);
    formData.set("body", body);
    if (tenantId) formData.set("tenantId", tenantId);

    startTransition(async () => {
      const result = await createComment(formData);
      if (result && "error" in result) {
        // Error handled silently — comment stays in textarea for retry
        return;
      }
      setBody("");
    });
  }

  return (
    <div className="px-6 py-4 border-t border-gray-100">
      <form onSubmit={handleSubmit} className="flex items-start gap-3">
        <Avatar name={currentUserName} src={currentUserAvatar} size="sm" />
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none resize-none"
          />
          <div className="flex justify-end mt-2">
            <Button type="submit" size="sm" disabled={!body.trim() || isPending}>
              {isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
