import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  try {
    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const tsQuery = q.split(/\s+/).filter(Boolean).join(" & ");
    if (!tsQuery) return NextResponse.json([]);

    // For CK internal users, search all. For customers, filter by tenant.
    const isInternal = session.claims.tenantType === "internal";
    const tenantId = session.claims.tenantId;

    const likePattern = `%${q}%`;

    // Build queries with optional tenant filter
    // 1) Sites matching by their own search_vector (name, city, state, address)
    let sitesQuery = admin
      .from("sites")
      .select("id, name, slug, customer:customers!inner(slug, name)")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // 2) Sites matching by customer name (e.g. searching "americold" returns all their sites)
    let sitesByCustomerQuery = admin
      .from("sites")
      .select("id, name, slug, customer:customers!inner(slug, name)")
      .ilike("customers.name", likePattern)
      .limit(10);

    // 3) Customers themselves
    let customersQuery = admin
      .from("customers")
      .select("id, name, slug")
      .ilike("name", likePattern)
      .limit(5);

    let milestonesQuery = admin
      .from("milestones")
      .select("id, name, slug, site:sites!inner(slug, name, customer:customers!inner(slug, name))")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    let tasksQuery = admin
      .from("tasks")
      .select("id, title, milestone:milestones!inner(slug, name, site:sites!inner(slug, customer:customers!inner(slug)))")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // Voice notes: search by title (ilike) since no tsvector column
    let voiceNotesQuery = admin
      .from("voice_notes")
      .select("id, title, status, site:sites(slug, name, customer:customers!inner(slug)), milestone:milestones(slug, name)")
      .ilike("title", likePattern)
      .eq("status", "ready")
      .limit(5);

    // Also search transcriptions by summary text, joined back to voice_notes
    let transcriptionsQuery = admin
      .from("transcriptions")
      .select("id, summary, voice_note:voice_notes!inner(id, title, status, site:sites(slug, name, customer:customers!inner(slug)), milestone:milestones(slug, name))")
      .ilike("summary", likePattern)
      .limit(5);

    // Comments: search via existing search_vector
    let commentsQuery = admin
      .from("comments")
      .select("id, body, entity_type, entity_id, author:profiles!inner(full_name)")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // Apply tenant filter for customer users
    if (!isInternal && tenantId) {
      sitesQuery = sitesQuery.eq("tenant_id", tenantId);
      sitesByCustomerQuery = sitesByCustomerQuery.eq("tenant_id", tenantId);
      customersQuery = customersQuery.eq("tenant_id", tenantId);
      milestonesQuery = milestonesQuery.eq("tenant_id", tenantId);
      tasksQuery = tasksQuery.eq("tenant_id", tenantId);
      voiceNotesQuery = voiceNotesQuery.eq("tenant_id", tenantId);
      transcriptionsQuery = transcriptionsQuery.eq("tenant_id", tenantId);
      commentsQuery = commentsQuery.eq("tenant_id", tenantId);
    }

    // Customer users should not see voice notes (CK-only feature)
    const includeVoiceNotes = isInternal;

    const [sitesRes, sitesByCustomerRes, customersRes, milestonesRes, tasksRes, voiceNotesRes, transcriptionsRes, commentsRes] = await Promise.all([
      sitesQuery,
      sitesByCustomerQuery,
      customersQuery,
      milestonesQuery,
      tasksQuery,
      includeVoiceNotes ? voiceNotesQuery : Promise.resolve({ data: [] }),
      includeVoiceNotes ? transcriptionsQuery : Promise.resolve({ data: [] }),
      commentsQuery,
    ]);

    type Result = { id: string; title: string; subtitle: string; type: string; href: string };
    const results: Result[] = [];

    // Customers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (customersRes.data ?? []) as any[]) {
      results.push({
        id: c.id,
        title: c.name,
        subtitle: "Company",
        type: "customer",
        href: `/customers/${c.slug}`,
      });
    }

    // Sites (from search_vector match + customer name match, deduplicated)
    const seenSiteIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allSites = [...(sitesRes.data ?? []), ...(sitesByCustomerRes.data ?? [])] as any[];
    for (const s of allSites) {
      if (seenSiteIds.has(s.id)) continue;
      seenSiteIds.add(s.id);
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
        subtitle: m.site?.name ?? "",
        type: "milestone",
        href: `/customers/${m.site?.customer?.slug}/sites/${m.site?.slug}/milestones/${m.slug}`,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (tasksRes.data ?? []) as any[]) {
      results.push({
        id: t.id,
        title: t.title,
        subtitle: t.milestone?.name ?? "",
        type: "task",
        href: `/customers/${t.milestone?.site?.customer?.slug}/sites/${t.milestone?.site?.slug}/milestones/${t.milestone?.slug}`,
      });
    }

    // Voice notes (from title search)
    const seenVoiceNoteIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of (voiceNotesRes.data ?? []) as any[]) {
      seenVoiceNoteIds.add(v.id);
      results.push({
        id: v.id,
        title: v.title || "Untitled Voice Note",
        subtitle: v.site?.name ?? v.milestone?.name ?? "",
        type: "voice_note",
        href: `/voice-notes/${v.id}`,
      });
    }

    // Voice notes (from transcription text search) — deduplicate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const tr of (transcriptionsRes.data ?? []) as any[]) {
      const vn = tr.voice_note;
      if (!vn || seenVoiceNoteIds.has(vn.id)) continue;
      seenVoiceNoteIds.add(vn.id);
      results.push({
        id: vn.id,
        title: vn.title || (tr.summary ? tr.summary.slice(0, 60) + "…" : "Voice Note"),
        subtitle: vn.site?.name ?? vn.milestone?.name ?? "",
        type: "voice_note",
        href: `/voice-notes/${vn.id}`,
      });
    }

    // Comments — show a snippet of the body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (commentsRes.data ?? []) as any[]) {
      const snippet = c.body?.length > 80 ? c.body.slice(0, 80) + "…" : c.body;
      results.push({
        id: c.id,
        title: snippet,
        subtitle: `${c.author?.full_name ?? "Unknown"} · ${c.entity_type}`,
        type: "comment",
        href: "#", // Comments don't have their own page — could link to parent entity
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json([]);
  }
}
