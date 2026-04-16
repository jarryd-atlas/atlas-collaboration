"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Calendar, CheckCircle2, Building2 } from "lucide-react";
import { Avatar } from "../../../components/ui/avatar";
import { EmptyState } from "../../../components/ui/empty-state";
import { NewSeriesDialog } from "../../../components/meetings/new-series-dialog";

interface MeetingSeriesItem {
  id: string;
  title: string;
  type: string;
  cadence?: string | null;
  customer?: { id: string; name: string; slug: string } | null;
  participants: { id: string; full_name: string; avatar_url: string | null }[];
  latest_meeting_date: string | null;
  latest_meeting_status: string | null;
  open_action_items: number;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  standup: "bg-blue-50 text-blue-700",
  one_on_one: "bg-purple-50 text-purple-700",
  account_360: "bg-brand-green/10 text-brand-dark",
};

const TYPE_BADGE_LABELS: Record<string, string> = {
  standup: "Standup",
  one_on_one: "1:1",
  account_360: "Account 360",
};

interface TeamMember {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  email: string;
}

interface MeetingsListProps {
  series: MeetingSeriesItem[];
  currentUserId: string;
  teamMembers: TeamMember[];
}

export function MeetingsList({ series, currentUserId, teamMembers }: MeetingsListProps) {
  const router = useRouter();
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">Standups, 1:1s, and Account 360 syncs</p>
        </div>
        <button
          onClick={() => setShowNewDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New meeting
        </button>
      </div>

      {/* Series list */}
      {series.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No meetings yet"
          description="Create a standup to start collaborating with your team during meetings."
        />
      ) : (
        <div className="space-y-3">
          {[...series]
            .sort((a, b) => {
              // Account 360 meetings sort by customer name; others by updated_at (already set upstream)
              if (a.type === "account_360" && b.type === "account_360") {
                return (a.customer?.name ?? "").localeCompare(b.customer?.name ?? "");
              }
              if (a.type === "account_360") return -1;
              if (b.type === "account_360") return 1;
              return 0;
            })
            .map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/meetings/${s.id}`)}
              className="group bg-white rounded-xl border border-gray-100 shadow-card hover:shadow-card-hover px-6 py-4 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-dark truncate">
                      {s.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        TYPE_BADGE_STYLES[s.type] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {TYPE_BADGE_LABELS[s.type] ?? s.type}
                    </span>
                    {s.type === "account_360" && s.cadence && (
                      <span className="inline-flex items-center rounded-full bg-gray-50 text-gray-500 px-1.5 py-0.5 text-[10px] capitalize">
                        {s.cadence}
                      </span>
                    )}
                  </div>
                  {s.type === "account_360" && s.customer && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-gray-400" />
                      {s.customer.name}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-1.5">
                    {/* Participants */}
                    <div className="flex items-center -space-x-1.5">
                      {s.participants.slice(0, 5).map((p) => (
                        <Avatar
                          key={p.id}
                          name={p.full_name}
                          src={p.avatar_url}
                          size="sm"
                        />
                      ))}
                      {s.participants.length > 5 && (
                        <span className="text-[10px] text-gray-400 ml-2">
                          +{s.participants.length - 5}
                        </span>
                      )}
                    </div>
                    {/* Last meeting */}
                    {s.latest_meeting_date && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(s.latest_meeting_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Open action items */}
                {s.open_action_items > 0 && (
                  <div className="flex items-center gap-1.5 text-xs shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-gray-500">
                      {s.open_action_items} open
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New series dialog */}
      <NewSeriesDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        teamMembers={teamMembers}
        currentUserId={currentUserId}
      />
    </div>
  );
}
