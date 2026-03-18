import Link from "next/link";
import { FileAudio, Clock, CheckCircle, AlertCircle, Loader2, MapPin } from "lucide-react";
import { Badge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";
import type { VoiceNote, VoiceNoteStatus } from "../../lib/mock-data";

interface VoiceNoteCardProps {
  note: VoiceNote;
  className?: string;
}

const statusConfig: Record<
  VoiceNoteStatus,
  { label: string; variant: "default" | "success" | "warning" | "error" | "info"; icon: React.ReactNode }
> = {
  uploading: {
    label: "Uploading",
    variant: "default",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  transcribing: {
    label: "Transcribing",
    variant: "info",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  summarizing: {
    label: "Summarizing",
    variant: "info",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  ready: {
    label: "Ready",
    variant: "success",
    icon: <CheckCircle className="h-3 w-3" />,
  },
  error: {
    label: "Error",
    variant: "error",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function VoiceNoteCard({ note, className }: VoiceNoteCardProps) {
  const config = statusConfig[note.status];

  return (
    <Link
      href={`/voice-notes/${note.id}`}
      className={cn(
        "block rounded-xl border border-gray-100 bg-white p-4 shadow-card",
        "hover:border-gray-200 hover:shadow-md transition-all",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            note.status === "error" ? "bg-red-50" : "bg-brand-green/10",
          )}
        >
          <FileAudio
            className={cn(
              "h-5 w-5",
              note.status === "error" ? "text-red-500" : "text-brand-green",
            )}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">{note.title}</h3>
            <Badge variant={config.variant} className="shrink-0 gap-1">
              {config.icon}
              {config.label}
            </Badge>
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(note.duration)}
            </span>
            <span>{formatRelativeDate(note.createdAt)}</span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Avatar name={note.recordedByName} size="sm" />
              <span className="text-xs text-gray-500">{note.recordedByName}</span>
            </div>

            {note.siteName && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3 w-3" />
                {note.siteName}
              </span>
            )}
          </div>

          {note.milestoneName && (
            <p className="mt-1.5 text-xs text-gray-400 truncate">
              Milestone: {note.milestoneName}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
