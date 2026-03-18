import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  FileAudio,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ListTodo,
  MessageSquare,
  Lightbulb,
  ArrowUpRight,
  Check,
  Pencil,
  X,
  MapPin,
} from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Avatar } from "../../../../components/ui/avatar";
import { getVoiceNoteById, getCommentsForEntity } from "../../../../lib/mock-data";
import type { VoiceNoteStatus, ExtractedTask } from "../../../../lib/mock-data";

interface PageProps {
  params: Promise<{ noteId: string }>;
}

const statusConfig: Record<
  VoiceNoteStatus,
  { label: string; variant: "default" | "success" | "warning" | "error" | "info"; icon: React.ReactNode }
> = {
  uploading: { label: "Uploading", variant: "default", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  transcribing: { label: "Transcribing", variant: "info", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  summarizing: { label: "Summarizing", variant: "info", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  ready: { label: "Ready", variant: "success", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  error: { label: "Error", variant: "error", icon: <AlertCircle className="h-3.5 w-3.5" /> },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const priorityColors: Record<string, string> = {
  low: "text-gray-500",
  medium: "text-blue-600",
  high: "text-amber-600",
  urgent: "text-red-600",
};

export default async function VoiceNoteDetailPage({ params }: PageProps) {
  const { noteId } = await params;
  const note = getVoiceNoteById(noteId);

  if (!note) notFound();

  const config = statusConfig[note.status];
  const comments = getCommentsForEntity("voice_note", note.id);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400">
        <Link href="/voice-notes" className="hover:text-gray-600 transition-colors">
          Voice Notes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-700 font-medium truncate">{note.title}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{note.title}</h1>
            <Badge variant={config.variant} className="shrink-0 gap-1">
              {config.icon}
              {config.label}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Avatar name={note.recordedByName} size="sm" />
              <span>{note.recordedByName}</span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(note.duration)}
            </span>
            <span>{formatDate(note.createdAt)}</span>
          </div>
          {(note.siteName || note.milestoneName) && (
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
              {note.siteName && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {note.siteName}
                </span>
              )}
              {note.milestoneName && (
                <span>Milestone: {note.milestoneName}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audio player */}
      {note.audioUrl && (
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-card">
          <audio controls className="w-full" preload="metadata">
            <source src={note.audioUrl} type="audio/webm" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Error message */}
      {note.status === "error" && note.errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Processing Error</p>
            <p className="text-sm text-red-700 mt-1">{note.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Processing state */}
      {(note.status === "transcribing" || note.status === "summarizing" || note.status === "uploading") && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              {note.status === "uploading" && "Uploading audio..."}
              {note.status === "transcribing" && "Transcribing audio with AI..."}
              {note.status === "summarizing" && "Generating summary and extracting items..."}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">This usually takes a minute or two.</p>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {note.summary && (
        <section className="rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <Lightbulb className="h-4 w-4 text-brand-green" />
            <h2 className="text-base font-semibold text-gray-900">AI Summary</h2>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-700 leading-relaxed">{note.summary}</p>
          </div>
        </section>
      )}

      {/* Transcript */}
      {note.transcript && (
        <section className="rounded-xl border border-gray-100 bg-white shadow-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">Transcript</h2>
          </div>
          <div className="px-6 py-4">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{note.transcript}</p>
          </div>
        </section>
      )}

      {/* Extracted items */}
      {note.status === "ready" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks */}
          {note.extractedTasks.length > 0 && (
            <section className="rounded-xl border border-gray-100 bg-white shadow-card lg:col-span-2">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <ListTodo className="h-4 w-4 text-brand-green" />
                <h2 className="text-base font-semibold text-gray-900">
                  Extracted Tasks ({note.extractedTasks.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {note.extractedTasks.map((task) => (
                  <ExtractedTaskRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}

          {/* Decisions */}
          {note.extractedDecisions.length > 0 && (
            <section className="rounded-xl border border-gray-100 bg-white shadow-card">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                <h2 className="text-base font-semibold text-gray-900">
                  Decisions ({note.extractedDecisions.length})
                </h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {note.extractedDecisions.map((decision, i) => (
                  <li key={i} className="px-6 py-3 text-sm text-gray-700">
                    {decision}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Updates */}
          {note.extractedUpdates.length > 0 && (
            <section className="rounded-xl border border-gray-100 bg-white shadow-card">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <ArrowUpRight className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-gray-900">
                  Updates ({note.extractedUpdates.length})
                </h2>
              </div>
              <ul className="divide-y divide-gray-50">
                {note.extractedUpdates.map((update, i) => (
                  <li key={i} className="px-6 py-3 text-sm text-gray-700">
                    {update}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Comments */}
      <section className="rounded-xl border border-gray-100 bg-white shadow-card">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Comments</h2>
        </div>
        {comments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">No comments yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {comments.map((comment) => (
              <div key={comment.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar name={comment.authorName} size="sm" />
                  <span className="text-sm font-medium text-gray-900">{comment.authorName}</span>
                  <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 ml-8">{comment.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExtractedTaskRow({ task }: { task: ExtractedTask }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
          <span className={`text-xs font-medium capitalize ${priorityColors[task.priority] ?? "text-gray-500"}`}>
            {task.priority}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
          {task.assigneeName && <span>Assigned to {task.assigneeName}</span>}
          {task.dueDate && <span>Due {task.dueDate}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {task.status === "pending" ? (
          <>
            <Button variant="primary" size="sm" className="gap-1 text-xs">
              <Check className="h-3 w-3" />
              Approve
            </Button>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 text-xs">
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : task.status === "approved" ? (
          <Badge variant="success">Approved</Badge>
        ) : (
          <Badge variant="default">Dismissed</Badge>
        )}
      </div>
    </div>
  );
}
