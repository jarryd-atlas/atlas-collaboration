import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/data/current-user";
import { getMeetingSeries } from "../../../lib/data/meeting-queries";
import { getInternalProfiles } from "../../../lib/data/queries";
import { MeetingsList } from "./meetings-list";

export default async function MeetingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.sessionClaims?.tenantType !== "internal") redirect("/");

  let series: Awaited<ReturnType<typeof getMeetingSeries>> = [];
  let internalProfiles: any[] = [];

  try {
    [series, internalProfiles] = await Promise.all([
      getMeetingSeries(currentUser.id),
      getInternalProfiles(),
    ]);
  } catch {
    // Show empty state
  }

  const teamMembers = internalProfiles.map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    avatarUrl: p.avatar_url,
    email: p.email,
  }));

  return (
    <MeetingsList
      series={series}
      currentUserId={currentUser.id}
      teamMembers={teamMembers}
    />
  );
}
