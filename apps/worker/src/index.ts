/**
 * ATLAS Collaborate Worker
 * Polls the job_queue table and processes jobs:
 *  - transcribe_voice_note: Deepgram transcription → Claude summarization
 *
 * Runs as a standalone Node.js process on Railway.
 */

import { createClient } from "@supabase/supabase-js";
import { processTranscriptionJob } from "./jobs/transcribe.js";

const POLL_INTERVAL_MS = 5_000; // 5 seconds
const MAX_ATTEMPTS = 3;

// ─── Supabase admin client ─────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env vars");
  return createClient(url, key);
}

// ─── Job poller ─────────────────────────────────────────────

interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

async function pollForJobs() {
  const supabase = getSupabase();

  // Atomically claim a pending job (simple advisory lock via locked_at)
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .update({ status: "processing", locked_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(1)
    .select("*");

  if (error) {
    console.error("[Worker] Poll error:", error.message);
    return;
  }

  if (!jobs || jobs.length === 0) return;

  const job = jobs[0] as Job;
  console.log(`[Worker] Processing job ${job.id} (${job.type})`);

  try {
    // Increment attempt count
    await supabase
      .from("job_queue")
      .update({ attempts: job.attempts + 1 })
      .eq("id", job.id);

    // Route to handler
    switch (job.type) {
      case "transcribe_voice_note":
        await processTranscriptionJob(supabase, job.payload);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Mark complete
    await supabase
      .from("job_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    console.log(`[Worker] Job ${job.id} completed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Job ${job.id} failed:`, message);

    const newAttempts = job.attempts + 1;
    await supabase
      .from("job_queue")
      .update({
        status: newAttempts >= job.max_attempts ? "failed" : "pending",
        error: message,
        locked_at: null,
      })
      .eq("id", job.id);

    // If job failed, also update the voice note status
    if (job.type === "transcribe_voice_note" && job.payload.voice_note_id) {
      await supabase
        .from("voice_notes")
        .update({ status: "error" })
        .eq("id", job.payload.voice_note_id);
    }
  }
}

// ─── Main loop ──────────────────────────────────────────────

async function main() {
  console.log("[Worker] ATLAS Collaborate Worker starting...");
  console.log(`[Worker] Polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Verify env vars
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[Worker] Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const optional = ["DEEPGRAM_API_KEY", "ANTHROPIC_API_KEY"];
  const missingOptional = optional.filter((k) => !process.env[k]);
  if (missingOptional.length > 0) {
    console.warn(
      `[Worker] Optional env vars not set (some jobs will fail): ${missingOptional.join(", ")}`,
    );
  }

  console.log("[Worker] Ready — polling for jobs...");

  // Poll loop
  const poll = async () => {
    try {
      await pollForJobs();
    } catch (err) {
      console.error("[Worker] Unexpected error:", err);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  };

  await poll();
}

main().catch((err) => {
  console.error("[Worker] Fatal:", err);
  process.exit(1);
});
