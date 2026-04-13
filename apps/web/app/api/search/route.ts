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
    // Prefix matching (:*) so partial words match — "San Anto" → "San:* & Anto:*" matches "San Antonio"
    const tsQuery = q.split(/\s+/).filter(Boolean).map((t) => `${t}:*`).join(" & ");
    if (!tsQuery) return NextResponse.json([]);

    // For CK internal users, search all. For customers, filter by tenant.
    const isInternal = session.claims.tenantType === "internal";
    const tenantId = session.claims.tenantId;

    const likePattern = `%${q}%`;

    // Build queries with optional tenant filter
    // 1) Sites matching by their own search_vector (name, city, state, address)
    let sitesQuery = admin
      .from("sites")
      .select("id, name, slug, pipeline_stage, customer:customers!inner(slug, name)")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // 2) Sites matching by name via ILIKE (fallback for partial words tsvector misses)
    let sitesByNameQuery = admin
      .from("sites")
      .select("id, name, slug, pipeline_stage, customer:customers!inner(slug, name)")
      .ilike("name", likePattern)
      .limit(5);

    // 3) Sites matching by customer name (e.g. searching "americold" returns all their sites)
    let sitesByCustomerQuery = admin
      .from("sites")
      .select("id, name, slug, pipeline_stage, customer:customers!inner(slug, name)")
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

    // Voice notes: search via tsvector (fast full-text search)
    let voiceNotesQuery = admin
      .from("voice_notes")
      .select("id, title, status, site:sites(slug, name, customer:customers!inner(slug)), milestone:milestones(slug, name)")
      .textSearch("search_vector", tsQuery)
      .eq("status", "ready")
      .limit(5);

    // Transcriptions: search via tsvector (summary + raw_text)
    let transcriptionsQuery = admin
      .from("transcriptions")
      .select("id, summary, voice_note:voice_notes!inner(id, title, status, site:sites(slug, name, customer:customers!inner(slug)), milestone:milestones(slug, name))")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // Comments: search via existing search_vector
    let commentsQuery = admin
      .from("comments")
      .select("id, body, entity_type, entity_id, author:profiles!inner(full_name)")
      .textSearch("search_vector", tsQuery)
      .limit(5);

    // Rocks: search by title (internal only, no tenant_id column)
    const rocksQuery = (admin as any)
      .from("rocks")
      .select("id, title, status, level, owner:profiles!rocks_owner_id_fkey(full_name)")
      .ilike("title", likePattern)
      .limit(5);

    // Meeting series: search by title (internal only)
    const meetingSeriesQuery = (admin as any)
      .from("meeting_series")
      .select("id, title, type")
      .ilike("title", likePattern)
      .limit(5);

    // Customer meetings: search by title (internal only, recent/upcoming only)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const customerMeetingsQuery = (admin as any)
      .from("customer_meetings")
      .select("id, title, meeting_date, customer:customers!inner(slug, name)")
      .ilike("title", likePattern)
      .gte("meeting_date", thirtyDaysAgo)
      .order("meeting_date", { ascending: false })
      .limit(5);

    // Initiatives: search by title (collaborative — visible to customer users too)
    let initiativesQuery = (admin as any)
      .from("initiatives")
      .select("id, title, status, customer:customers!inner(slug, name)")
      .ilike("title", likePattern)
      .limit(5);

    // Apply tenant filter for customer users
    if (!isInternal && tenantId) {
      sitesQuery = sitesQuery.eq("tenant_id", tenantId);
      sitesByNameQuery = sitesByNameQuery.eq("tenant_id", tenantId);
      sitesByCustomerQuery = sitesByCustomerQuery.eq("tenant_id", tenantId);
      customersQuery = customersQuery.eq("tenant_id", tenantId);
      milestonesQuery = milestonesQuery.eq("tenant_id", tenantId);
      tasksQuery = tasksQuery.eq("tenant_id", tenantId);
      voiceNotesQuery = voiceNotesQuery.eq("tenant_id", tenantId);
      transcriptionsQuery = transcriptionsQuery.eq("tenant_id", tenantId);
      commentsQuery = commentsQuery.eq("tenant_id", tenantId);
      initiativesQuery = initiativesQuery.eq("tenant_id", tenantId);
    }

    // Customer users should not see voice notes, rocks, meetings (CK-only features)
    const includeVoiceNotes = isInternal;
    const includeInternalOnly = isInternal;

    // For meeting series, we need participant filtering
    const profileId = session.claims.profileId;
    let participantSeriesIds: Set<string> | null = null;
    if (includeInternalOnly && profileId) {
      const { data: participantRows } = await (admin as any)
        .from("meeting_participants")
        .select("series_id")
        .eq("profile_id", profileId);
      participantSeriesIds = new Set((participantRows ?? []).map((r: any) => r.series_id));
    }

    const [
      sitesRes, sitesByNameRes, sitesByCustomerRes, customersRes, milestonesRes, tasksRes,
      voiceNotesRes, transcriptionsRes, commentsRes,
      rocksRes, meetingSeriesRes, customerMeetingsRes, initiativesRes,
    ] = await Promise.all([
      sitesQuery,
      sitesByNameQuery,
      sitesByCustomerQuery,
      customersQuery,
      milestonesQuery,
      tasksQuery,
      includeVoiceNotes ? voiceNotesQuery : Promise.resolve({ data: [] }),
      includeVoiceNotes ? transcriptionsQuery : Promise.resolve({ data: [] }),
      commentsQuery,
      includeInternalOnly ? rocksQuery : Promise.resolve({ data: [] }),
      includeInternalOnly ? meetingSeriesQuery : Promise.resolve({ data: [] }),
      includeInternalOnly ? customerMeetingsQuery : Promise.resolve({ data: [] }),
      initiativesQuery,
    ]);

    type Result = { id: string; title: string; subtitle: string; type: string; href: string; pipelineStage?: string };
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
    const allSites = [...(sitesRes.data ?? []), ...(sitesByNameRes.data ?? []), ...(sitesByCustomerRes.data ?? [])] as any[];
    for (const s of allSites) {
      if (seenSiteIds.has(s.id)) continue;
      seenSiteIds.add(s.id);
      results.push({
        id: s.id,
        title: s.name,
        subtitle: s.customer?.name ?? "",
        type: "site",
        href: `/customers/${s.customer?.slug}/sites/${s.slug}`,
        pipelineStage: s.pipeline_stage ?? undefined,
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

    // Rocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (rocksRes.data ?? []) as any[]) {
      const ownerName = r.owner?.full_name;
      results.push({
        id: r.id,
        title: r.title,
        subtitle: ownerName ? `Rock · ${ownerName}` : "Rock",
        type: "rock",
        href: "/rocks",
      });
    }

    // Meeting series (filtered to user's series)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ms of (meetingSeriesRes.data ?? []) as any[]) {
      if (participantSeriesIds && !participantSeriesIds.has(ms.id)) continue;
      const typeLabel = ms.type === "one_on_one" ? "1:1" : ms.type === "standup" ? "Standup" : ms.type;
      results.push({
        id: ms.id,
        title: ms.title,
        subtitle: typeLabel,
        type: "meeting",
        href: `/meetings/${ms.id}`,
      });
    }

    // Customer meetings (synced from Google Calendar)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const cm of (customerMeetingsRes.data ?? []) as any[]) {
      const dateStr = cm.meeting_date
        ? new Date(cm.meeting_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "";
      results.push({
        id: cm.id,
        title: cm.title,
        subtitle: `${cm.customer?.name ?? ""}${dateStr ? ` · ${dateStr}` : ""}`,
        type: "customer_meeting",
        href: `/customers/${cm.customer?.slug ?? ""}`,
      });
    }

    // Initiatives
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const i of (initiativesRes.data ?? []) as any[]) {
      const statusLabel = i.status ? i.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "";
      results.push({
        id: i.id,
        title: i.title,
        subtitle: `${i.customer?.name ?? ""}${statusLabel ? ` · ${statusLabel}` : ""}`,
        type: "initiative",
        href: `/customers/${i.customer?.slug ?? ""}`,
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json([]);
  }
}
