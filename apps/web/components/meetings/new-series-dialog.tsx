"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Avatar } from "../ui/avatar";
import { createMeetingSeries } from "../../lib/actions/meetings";
import { Search, Check } from "lucide-react";

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface NewSeriesDialogProps {
  open: boolean;
  onClose: () => void;
  teamMembers: TeamMember[];
  currentUserId: string;
}

export function NewSeriesDialog({ open, onClose, teamMembers, currentUserId }: NewSeriesDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filteredMembers = search
    ? teamMembers.filter(
        (m) =>
          m.fullName.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : teamMembers;

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least one team member");
      return;
    }
    setError("");

    startTransition(async () => {
      const result = await createMeetingSeries(title.trim(), "standup", [...selectedIds]);
      if ("error" in result) {
        setError(result.error);
      } else {
        onClose();
        setTitle("");
        setSelectedIds(new Set());
        router.push(`/meetings/${result.id}`);
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>New Standup</DialogHeader>
      <DialogBody className="space-y-4">
        {/* Title */}
        <div>
          <label htmlFor="standup-title" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="standup-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Sales Team Weekly"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
            autoFocus
          />
        </div>

        {/* Participants */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Participants
            {selectedIds.size > 0 && (
              <span className="ml-1 text-gray-400 font-normal">({selectedIds.size} selected)</span>
            )}
          </label>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
            />
          </div>

          {/* Member list */}
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
            {filteredMembers.map((m) => {
              const selected = selectedIds.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    selected ? "bg-brand-green/5" : ""
                  }`}
                >
                  <Avatar name={m.fullName} src={m.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.fullName}</p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  {selected && (
                    <Check className="h-4 w-4 text-brand-green shrink-0" />
                  )}
                </button>
              );
            })}
            {filteredMembers.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No matches</p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </DialogBody>
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Creating..." : "Create Standup"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
