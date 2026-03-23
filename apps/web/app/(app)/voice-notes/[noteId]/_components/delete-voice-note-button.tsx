"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { deleteVoiceNote } from "../../../../../lib/actions/voice";

export function DeleteVoiceNoteButton({ voiceNoteId }: { voiceNoteId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteVoiceNote(voiceNoteId);
    if (result.success) {
      router.push("/voice-notes");
    } else {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">Delete this voice note?</span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Yes, delete"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-gray-400 hover:text-red-600"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-4 w-4 mr-1" />
      Delete
    </Button>
  );
}
