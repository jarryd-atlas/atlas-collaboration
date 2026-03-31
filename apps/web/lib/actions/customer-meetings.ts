"use server";

import { createSupabaseAdmin } from "../supabase/server";
import { revalidatePath } from "next/cache";

const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

export async function fetchCustomerMeetings(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "customer_meetings")
    .select("id, google_event_id, title, description, meeting_date, meeting_end, location, html_link, organizer_email, attendees, ck_attendees, meeting_brief_id, synced_at")
    .eq("customer_id", customerId)
    .order("meeting_date", { ascending: false })
    .limit(100);

  if (error) return { error: error.message };
  return { meetings: data || [] };
}

export async function linkMeetingBrief(meetingId: string, briefId: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase, "customer_meetings")
    .update({ meeting_brief_id: briefId })
    .eq("id", meetingId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}
