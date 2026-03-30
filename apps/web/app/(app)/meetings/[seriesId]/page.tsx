import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "../../../../lib/data/current-user";
import { getMeetingSeriesDetail, getMeetingsWithItems, getStandupCustomerData, getStandupDealData } from "../../../../lib/data/meeting-queries";
import { getInternalProfiles } from "../../../../lib/data/queries";
import { StandupDashboard } from "./standup-dashboard";

interface Props {
  params: Promise<{ seriesId: string }>;
}

export default async function MeetingDetailPage({ params }: Props) {
  const { seriesId } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.sessionClaims?.tenantType !== "internal") redirect("/");

  const [seriesDetail, meetings, customerData, internalProfiles, dealData] = await Promise.all([
    getMeetingSeriesDetail(seriesId),
    getMeetingsWithItems(seriesId),
    getStandupCustomerData(),
    getInternalProfiles(),
    getStandupDealData(),
  ]);

  if (!seriesDetail) notFound();

  // Verify current user is a participant
  const isParticipant = seriesDetail.participants.some((p: any) => p.id === currentUser.id);
  if (!isParticipant) redirect("/meetings");

  const teamMembers = internalProfiles.map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    avatarUrl: p.avatar_url,
    email: p.email,
  }));

  return (
    <StandupDashboard
      series={seriesDetail}
      meetings={meetings}
      customerData={customerData}
      dealData={dealData}
      currentUserId={currentUser.id}
      teamMembers={teamMembers}
    />
  );
}
