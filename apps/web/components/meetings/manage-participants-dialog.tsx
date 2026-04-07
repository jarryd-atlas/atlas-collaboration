"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "../ui/dialog";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { addMeetingParticipant, removeMeetingParticipant } from "../../lib/actions/meetings";
import { Search, UserPlus, UserMinus } from "lucide-react";

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface Participant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

interface ManageParticipantsDialogProps {
  open: boolean;
  onClose: () => void;
  seriesId: string;
  participants: Participant[];
  teamMembers: TeamMember[];
  currentUserId: string;
}

export function ManageParticipantsDialog({
  open,
  onClose,
  seriesId,
  participants,
  teamMembers,
  currentUserId,
}: ManageParticipantsDialogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const participantIds = new Set(participants.map((p) => p.id));

  // Filter team members by search
  const filtered = teamMembers.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  // Split into current participants and available members
  const currentParticipants = filtered.filter((m) => participantIds.has(m.id));
  const availableMembers = filtered.filter((m) => !participantIds.has(m.id));

  function handleAdd(profileId: string) {
    setError("");
    setPendingId(profileId);
    startTransition(async () => {
      const result = await addMeetingParticipant(seriesId, profileId);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleRemove(profileId: string) {
    setError("");
    setPendingId(profileId);
    startTransition(async () => {
      const result = await removeMeetingParticipant(seriesId, profileId);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>Manage Participants</DialogHeader>
      <DialogBody className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
          />
        </div>

        {/* Current participants */}
        {currentParticipants.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              In this meeting ({currentParticipants.length})
            </p>
            <div className="space-y-1">
              {currentParticipants.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={m.fullName} src={m.avatarUrl} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.fullName}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                  </div>
                  {m.id !== currentUserId && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={isPending && pendingId === m.id}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded disabled:opacity-50"
                      title="Remove from meeting"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available members */}
        {availableMembers.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Add to meeting
            </p>
            <div className="space-y-1">
              {availableMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={m.fullName} src={m.avatarUrl} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.fullName}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(m.id)}
                    disabled={isPending && pendingId === m.id}
                    className="text-gray-400 hover:text-brand-green transition-colors p-1 rounded disabled:opacity-50"
                    title="Add to meeting"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No team members found matching &ldquo;{search}&rdquo;
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
