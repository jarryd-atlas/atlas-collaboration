/**
 * Transcription job handler.
 * Pipeline: Download audio → Deepgram transcription → Claude summarization → Save results
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { transcribeAudio } from "@repo/ai";
import { summarizeTranscript } from "@repo/ai";
import { Storage } from "@google-cloud/storage";

interface TranscribePayload {
  voice_note_id: string;
  file_path: string;
}

export async function processTranscriptionJob(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const { voice_note_id, file_path } = payload as unknown as TranscribePayload;

  if (!voice_note_id || !file_path) {
    throw new Error("Missing voice_note_id or file_path in job payload");
  }

  console.log(`[Transcribe] Starting for voice note ${voice_note_id}`);

  // 1. Update status to transcribing
  await supabase
    .from("voice_notes")
    .update({ status: "transcribing" })
    .eq("id", voice_note_id);

  // 2. Download audio from GCS
  console.log(`[Transcribe] Downloading audio: ${file_path}`);

  const gcsBucket = process.env.GCS_BUCKET;
  if (!gcsBucket) throw new Error("Missing GCS_BUCKET env var");

  // Support both inline JSON credentials and GOOGLE_APPLICATION_CREDENTIALS file path
  const saJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
  const storage = saJson
    ? new Storage({ credentials: JSON.parse(saJson) })
    : new Storage(); // Falls back to GOOGLE_APPLICATION_CREDENTIALS or ADC
  const [fileContents] = await storage.bucket(gcsBucket).file(file_path).download();
  const audioBuffer = Buffer.from(fileContents);
  console.log(`[Transcribe] Downloaded ${audioBuffer.length} bytes`);

  // 3. Transcribe with Deepgram
  console.log("[Transcribe] Sending to Deepgram...");
  const transcription = await transcribeAudio(audioBuffer);
  console.log(
    `[Transcribe] Got transcript (${transcription.rawText.length} chars, ${transcription.confidence.toFixed(2)} confidence)`,
  );

  // 4. Update status to summarizing
  await supabase
    .from("voice_notes")
    .update({ status: "summarizing" })
    .eq("id", voice_note_id);

  // 5. Get context for Claude (site/milestone name if linked)
  const { data: voiceNote } = await supabase
    .from("voice_notes")
    .select("site_id, milestone_id")
    .eq("id", voice_note_id)
    .single();

  let contextHint = "";
  if (voiceNote?.site_id) {
    const { data: site } = await supabase
      .from("sites")
      .select("name")
      .eq("id", voiceNote.site_id)
      .single();
    if (site) contextHint += `Site: ${site.name}. `;
  }
  if (voiceNote?.milestone_id) {
    const { data: milestone } = await supabase
      .from("milestones")
      .select("name")
      .eq("id", voiceNote.milestone_id)
      .single();
    if (milestone) contextHint += `Milestone: ${milestone.name}. `;
  }

  // 6. Summarize + extract with Claude
  console.log("[Transcribe] Sending to Claude for summarization...");
  const summary = await summarizeTranscript(
    transcription.rawText,
    contextHint || undefined,
  );
  console.log(
    `[Transcribe] Got summary (${summary.extractedTasks.length} tasks, ${summary.extractedDecisions.length} decisions)`,
  );

  // 7. Save transcription + summary to database
  const { error: saveError } = await supabase.from("transcriptions").insert({
    voice_note_id,
    tenant_id: (
      await supabase
        .from("voice_notes")
        .select("tenant_id")
        .eq("id", voice_note_id)
        .single()
    ).data?.tenant_id,
    raw_text: transcription.rawText,
    summary: summary.summary,
    extracted_tasks: summary.extractedTasks,
    extracted_decisions: summary.extractedDecisions,
    extracted_updates: summary.extractedUpdates,
  });

  if (saveError) {
    throw new Error(`Failed to save transcription: ${saveError.message}`);
  }

  // 8. Update voice note status to ready
  await supabase
    .from("voice_notes")
    .update({ status: "ready" })
    .eq("id", voice_note_id);

  console.log(`[Transcribe] Complete for voice note ${voice_note_id}`);
}
