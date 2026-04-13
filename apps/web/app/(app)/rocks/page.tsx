import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "../../../lib/data/current-user";
import { getInternalProfiles } from "../../../lib/data/queries";
import { getRocksForQuarter, getDistinctTeamsDepartments, getDistinctProfileTeams } from "../../../lib/data/rock-queries";
import { RocksPage } from "../../../components/rocks/rocks-page";

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

export default async function RocksRoute({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.sessionClaims?.tenantType !== "internal") redirect("/");

  const params = await searchParams;
  const defaults = getCurrentQuarter();
  const year = params.year ? parseInt(params.year, 10) : defaults.year;
  const quarter = params.quarter ? parseInt(params.quarter, 10) : defaults.quarter;

  let rocks: Awaited<ReturnType<typeof getRocksForQuarter>> = [];
  let internalProfiles: any[] = [];
  let teamSuggestions: string[] = [];
  let departmentSuggestions: string[] = [];

  try {
    const [rocksData, profiles, teamsDepts, profileTeams] = await Promise.all([
      getRocksForQuarter(year, quarter),
      getInternalProfiles(),
      getDistinctTeamsDepartments(),
      getDistinctProfileTeams(),
    ]);
    rocks = rocksData;
    internalProfiles = profiles;
    // Merge team suggestions from both rocks and profiles
    teamSuggestions = [...new Set([...teamsDepts.teams, ...profileTeams])].sort();
    departmentSuggestions = teamsDepts.departments;
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
    <Suspense>
      <RocksPage
        rocks={rocks}
        quarter={quarter}
        year={year}
        currentUserId={currentUser.id}
        teamMembers={teamMembers}
        teamSuggestions={teamSuggestions}
        departmentSuggestions={departmentSuggestions}
      />
    </Suspense>
  );
}
