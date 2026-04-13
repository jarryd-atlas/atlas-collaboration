import { createSupabaseAdmin } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

const LEVEL_ORDER = { company: 0, department: 1, team: 2, individual: 3 };

export interface RockCollaborator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

export interface RockRow {
  id: string;
  title: string;
  description: string | null;
  level: "individual" | "team" | "department" | "company";
  status: "on_track" | "off_track" | "complete" | "incomplete";
  quarter: number;
  year: number;
  owner_id: string;
  parent_rock_id: string | null;
  team_name: string | null;
  department_name: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
    team: string | null;
  };
  collaborators?: RockCollaborator[];
}

/**
 * Fetch all rocks for a given quarter/year, with owner profile joined.
 * Sorted by level (company first) then title.
 */
export async function getRocksForQuarter(year: number, quarter: number): Promise<RockRow[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await fromTable(admin, "rocks")
    .select("*, owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url, email, team)")
    .eq("year", year)
    .eq("quarter", quarter)
    .order("title", { ascending: true });

  if (error) {
    console.error("getRocksForQuarter error:", error.message);
    return [];
  }

  // Fetch collaborators for all rocks in this quarter
  const rockIds = (data as any[]).map((r: any) => r.id);
  let collabMap = new Map<string, RockCollaborator[]>();
  if (rockIds.length > 0) {
    const { data: collabs } = await fromTable(admin, "rock_collaborators")
      .select("rock_id, profile:profiles(id, full_name, avatar_url, email)")
      .in("rock_id", rockIds);
    if (collabs) {
      for (const c of collabs as any[]) {
        const existing = collabMap.get(c.rock_id) ?? [];
        if (c.profile) existing.push(c.profile);
        collabMap.set(c.rock_id, existing);
      }
    }
  }

  const rocks = (data as RockRow[]).map((r) => ({
    ...r,
    collaborators: collabMap.get(r.id) ?? [],
  }));

  // Sort by level order, then title
  return rocks.sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Fetch rocks owned by a specific user for a given quarter.
 */
export async function getRocksForUser(
  profileId: string,
  year: number,
  quarter: number,
): Promise<RockRow[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await fromTable(admin, "rocks")
    .select("*, owner:profiles!rocks_owner_id_fkey(id, full_name, avatar_url, email, team)")
    .eq("owner_id", profileId)
    .eq("year", year)
    .eq("quarter", quarter)
    .order("title", { ascending: true });

  if (error) {
    console.error("getRocksForUser error:", error.message);
    return [];
  }

  return (data as RockRow[]).sort((a, b) => {
    const levelDiff = (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Get distinct team and department names used in rocks (for filter dropdowns).
 */
export async function getDistinctTeamsDepartments(): Promise<{
  teams: string[];
  departments: string[];
}> {
  const admin = createSupabaseAdmin();

  const [{ data: teamData }, { data: deptData }] = await Promise.all([
    fromTable(admin, "rocks")
      .select("team_name")
      .not("team_name", "is", null)
      .order("team_name"),
    fromTable(admin, "rocks")
      .select("department_name")
      .not("department_name", "is", null)
      .order("department_name"),
  ]);

  const teamSet = new Set<string>();
  for (const r of (teamData ?? []) as any[]) {
    if (r.team_name) teamSet.add(r.team_name);
  }
  const deptSet = new Set<string>();
  for (const r of (deptData ?? []) as any[]) {
    if (r.department_name) deptSet.add(r.department_name);
  }

  return { teams: [...teamSet], departments: [...deptSet] };
}

/**
 * Get distinct teams from profiles (for autocomplete suggestions).
 */
export async function getDistinctProfileTeams(): Promise<string[]> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("profiles")
    .select("team")
    .not("team", "is", null)
    .order("team");

  return [...new Set((data ?? []).map((p: any) => p.team as string))];
}
