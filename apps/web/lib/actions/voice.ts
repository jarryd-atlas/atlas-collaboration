"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

/**
 * Upload a voice note audio file and create processing job.
 *
 * FormData fields:
 *  - audio: File (the recorded audio blob)
 *  - title: string
 *  - duration: string (seconds as string)
 *  - siteId?: string (optional linked site)
 *  - milestoneId?: string (optional linked milestone)
 */
export async function uploadVoiceNote(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.tenantId || !claims.profileId) {
      return { error: "Missing tenant or profile" };
    }

    const audio = formData.get("audio") as File;
    const title = formData.get("title") as string;
    const duration = parseInt(formData.get("duration") as string, 10);
    const siteId = (formData.get("siteId") as string) || null;
    const milestoneId = (formData.get("milestoneId") as string) || null;

    if (!audio || !title || isNaN(duration)) {
      return { error: "Missing required fields: audio, title, duration" };
    }

    const admin = createSupabaseAdmin();

    // 1. Upload audio to Supabase Storage
    const fileExt = audio.name?.split(".").pop() || "webm";
    const filePath = `${claims.tenantId}/${claims.profileId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await admin.storage
      .from("voice-notes")
      .upload(filePath, audio, {
        contentType: audio.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) return { error: uploadError.message };

    // 2. Get public URL for the uploaded file
    const { data: urlData } = admin.storage
      .from("voice-notes")
      .getPublicUrl(filePath);

    // 3. Create voice_notes row
    const { data: voiceNote, error: insertError } = await admin
      .from("voice_notes")
      .insert({
        tenant_id: claims.tenantId,
        title,
        duration_sec: duration,
        status: "transcribing",
        file_path: filePath,
        recorded_by: claims.profileId,
        site_id: siteId,
        milestone_id: milestoneId,
      })
      .select("id")
      .single();

    if (insertError) return { error: insertError.message };

    // 4. Create job_queue entry for the worker to pick up
    const { error: jobError } = await admin.from("job_queue").insert({
      type: "transcribe_voice_note",
      payload: {
        voice_note_id: voiceNote.id,
        file_path: filePath,
      },
      status: "pending",
    });

    if (jobError) return { error: jobError.message };

    revalidatePath("/voice-notes");

    return { id: voiceNote.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
