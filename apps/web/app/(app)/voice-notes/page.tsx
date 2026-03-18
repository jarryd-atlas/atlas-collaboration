import { getVoiceNotes } from "../../../lib/data/queries";
import { VoiceNotesClient } from "./voice-notes-client";

export default async function VoiceNotesPage() {
  let notes: Awaited<ReturnType<typeof getVoiceNotes>> = [];

  try {
    notes = await getVoiceNotes();
  } catch {
    // Show empty state
  }

  return <VoiceNotesClient notes={notes} />;
}
