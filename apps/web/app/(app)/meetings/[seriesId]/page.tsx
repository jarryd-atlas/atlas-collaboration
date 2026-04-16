import { redirect, notFound } from "next/navigation";
import { after } from "next/server";
import { getCurrentUser } from "../../../../lib/data/current-user";
import {
  getMeetingSeriesDetail,
  getMeetingsWithItems,
  getStandupCustomerData,
  getStandupDealData,
  getStandupStakeholderData,
} from "../../../../lib/data/meeting-queries";
import { getAccount360Snapshot } from "../../../../lib/data/account-360-queries";
import { getInternalProfiles } from "../../../../lib/data/queries";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";
import { triggerCalendarSyncForCurrentUser } from "../../../../lib/calendar/trigger-sync";
import { StandupDashboard } from "./standup-dashboard";
import { Account360Dashboard } from "./account360-dashboard";

interface Props {
  params: Promise<{ seriesId: string }>;
}

export default async function MeetingDetailPage({ params }: Props) {
  const { seriesId } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.sessionClaims?.tenantType !== "internal") redirect("/");

  after(triggerCalendarSyncForCurrentUser);

  const [seriesDetail, meetings, internalProfiles] = await Promise.all([
    getMeetingSeriesDetail(seriesId),
    getMeetingsWithItems(seriesId),
    getInternalProfiles(),
  ]);

  if (!seriesDetail) notFound();

  const teamMembers = internalProfiles.map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    avatarUrl: p.avatar_url,
    email: p.email,
  }));

  // ── Account 360 branch ───────────────────────────────────
  if (seriesDetail.type === "account_360") {
    if (!seriesDetail.customer_id) notFound();

    const snapshot = await getAccount360Snapshot(seriesDetail.customer_id);
    if (!snapshot) notFound();

    return (
      <Account360Dashboard
        series={seriesDetail}
        meetings={meetings}
        snapshot={snapshot}
        currentUserId={currentUser.id}
        teamMembers={teamMembers}
      />
    );
  }

  // ── Standup / 1:1 branch (existing behavior) ─────────────
  // Verify current user is a participant — these types are participant-gated.
  const isParticipant = seriesDetail.participants.some((p: any) => p.id === currentUser.id);
  if (!isParticipant) redirect("/meetings");

  const [customerData, dealData, stakeholderData] = await Promise.all([
    getStandupCustomerData(),
    getStandupDealData(),
    getStandupStakeholderData(),
  ]);

  // Fetch this week's + next week's customer meetings from Google Calendar sync
  let weeklyMeetings: Record<string, any[]> = {};
  let nextWeekMeetings: Record<string, any[]> = {};
  try {
    const supabase = createSupabaseAdmin();
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
    endOfWeek.setHours(23, 59, 59, 999);
    const startOfNextWeek = new Date(endOfWeek);
    startOfNextWeek.setDate(endOfWeek.getDate() + 1); // Next Sunday
    startOfNextWeek.setHours(0, 0, 0, 0);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6); // Next Saturday
    endOfNextWeek.setHours(23, 59, 59, 999);

    const { data: calMeetings } = await (supabase as any)
      .from("customer_meetings")
      .select("id, customer_id, title, meeting_date, meeting_end, attendees, ck_attendees, html_link")
      .gte("meeting_date", startOfWeek.toISOString())
      .lte("meeting_date", endOfNextWeek.toISOString())
      .order("meeting_date", { ascending: true });

    for (const m of calMeetings || []) {
      const meetingDate = new Date(m.meeting_date);
      if (meetingDate <= endOfWeek) {
        if (!weeklyMeetings[m.customer_id]) weeklyMeetings[m.customer_id] = [];
        weeklyMeetings[m.customer_id]!.push(m);
      } else {
        if (!nextWeekMeetings[m.customer_id]) nextWeekMeetings[m.customer_id] = [];
        nextWeekMeetings[m.customer_id]!.push(m);
      }
    }
  } catch {
    // non-critical
  }

  return (
    <StandupDashboard
      series={seriesDetail}
      meetings={meetings}
      customerData={customerData}
      dealData={dealData}
      weeklyMeetings={weeklyMeetings}
      nextWeekMeetings={nextWeekMeetings}
      stakeholderData={stakeholderData}
      currentUserId={currentUser.id}
      teamMembers={teamMembers}
    />
  );
}
