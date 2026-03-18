import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  try {
    const supabase = await createSupabaseServer();
    const tsQuery = q.split(/\s+/).join(" & ");

    const [sitesRes, milestonesRes, tasksRes] = await Promise.all([
      supabase
        .from("sites")
        .select("id, name, slug, customer:customers!inner(slug, name)")
        .textSearch("search_vector", tsQuery)
        .limit(5),
      supabase
        .from("milestones")
        .select("id, name, slug, site:sites!inner(slug, customer:customers!inner(slug))")
        .textSearch("search_vector", tsQuery)
        .limit(5),
      supabase
        .from("tasks")
        .select("id, title, milestone:milestones!inner(slug, site:sites!inner(slug, customer:customers!inner(slug)))")
        .textSearch("search_vector", tsQuery)
        .limit(5),
    ]);

    type Result = { id: string; title: string; subtitle: string; type: string; href: string };
    const results: Result[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sitesRes.data ?? []) as any[]) {
      results.push({
        id: s.id,
        title: s.name,
        subtitle: s.customer?.name ?? "",
        type: "site",
        href: `/customers/${s.customer?.slug}/sites/${s.slug}`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const m of (milestonesRes.data ?? []) as any[]) {
      results.push({
        id: m.id,
        title: m.name,
        subtitle: "",
        type: "milestone",
        href: `/customers/${m.site?.customer?.slug}/sites/${m.site?.slug}/milestones/${m.slug}`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (tasksRes.data ?? []) as any[]) {
      results.push({
        id: t.id,
        title: t.title,
        subtitle: "",
        type: "task",
        href: `/customers/${t.milestone?.site?.customer?.slug}/sites/${t.milestone?.site?.slug}/milestones/${t.milestone?.slug}`,
      });
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
