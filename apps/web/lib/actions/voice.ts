"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { uploadFile } from "../storage/gcs";

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

    // 1. Upload audio to GCS
    const fileExt = audio.name?.split(".").pop() || "webm";
    const filePath = `voice-notes/${claims.tenantId}/${claims.profileId}/${Date.now()}.${fileExt}`;
    const contentType = audio.type || "audio/webm";

    let fileBytes: Uint8Array;
    try {
      const ab = await audio.arrayBuffer();
      fileBytes = new Uint8Array(ab);
    } catch {
      return { error: "Failed to read audio data" };
    }

    try {
      await uploadFile(filePath, fileBytes, contentType);
    } catch (uploadErr) {
      return { error: uploadErr instanceof Error ? uploadErr.message : "Upload failed" };
    }

    // 2. Create voice_notes row
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

/**
 * Delete a voice note and cancel any pending processing jobs.
 */
export async function deleteVoiceNote(voiceNoteId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Missing profile" };

    const admin = createSupabaseAdmin();

    // Cancel any pending/processing jobs for this voice note
    await admin
      .from("job_queue")
      .update({ status: "failed", error: "Voice note deleted by user" })
      .match({ "payload->>voice_note_id": voiceNoteId })
      .in("status", ["pending", "processing"]);

    // Delete the voice note (cascades to transcriptions via FK)
    const { error } = await admin
      .from("voice_notes")
      .delete()
      .eq("id", voiceNoteId);

    if (error) return { error: error.message };

    revalidatePath("/voice-notes");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
