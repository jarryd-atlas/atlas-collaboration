/**
 * Deepgram transcription pipeline.
 * Transcribes audio files using Deepgram's Nova-2 model.
 */

import { createClient } from "@deepgram/sdk";

export interface TranscriptionResult {
  rawText: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  paragraphs: string[];
}

/**
 * Transcribe an audio buffer using Deepgram.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = "audio/webm",
): Promise<TranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY not set");

  const deepgram = createClient(apiKey);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-2",
      smart_format: true,
      paragraphs: true,
      diarize: true,
      punctuate: true,
      language: "en",
      mimetype: mimeType,
    },
  );

  if (error) throw error;

  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    throw new Error("No transcription result returned from Deepgram");
  }

  const rawText = alternative.transcript ?? "";
  const confidence = alternative.confidence ?? 0;

  // Extract words with timing
  const words = (alternative.words ?? []).map((w) => ({
    word: w.word ?? "",
    start: w.start ?? 0,
    end: w.end ?? 0,
    confidence: w.confidence ?? 0,
    speaker: w.speaker,
  }));

  // Extract paragraphs
  const paragraphData =
    alternative.paragraphs?.paragraphs ?? [];
  const paragraphs = paragraphData.map(
    (p) =>
      p.sentences
        ?.map((s) => s.text)
        .join(" ") ?? "",
  );

  return {
    rawText,
    confidence,
    words,
    paragraphs: paragraphs.length > 0 ? paragraphs : [rawText],
  };
}
