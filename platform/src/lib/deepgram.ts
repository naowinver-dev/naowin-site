import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

/**
 * Transcrit une réponse vidéo à partir de son URL de lecture Cloudflare
 * Stream (l'URL doit être accessible par Deepgram, donc signée avec une
 * expiration suffisamment longue pour couvrir le job).
 */
export async function transcribeVideo(videoUrl: string): Promise<string> {
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: videoUrl },
    { model: "nova-2", language: "fr", smart_format: true, punctuate: true },
  );

  if (error) throw new Error(`Deepgram transcription error: ${error.message}`);

  const transcript =
    result.results.channels[0]?.alternatives[0]?.transcript ?? "";

  return transcript.trim();
}
