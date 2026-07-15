import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { enableMp4Download } from "@/lib/cloudflare-stream";
import { transcribeVideo } from "@/lib/deepgram";

/**
 * Déclenché par le webhook Cloudflare Stream quand une réponse vidéo est
 * prête. Le rendu MP4 utilisé ici est interne au pipeline de transcription
 * (jamais exposé à l'entreprise) — le déblocage du téléchargement payant
 * pour l'entreprise reste un flux séparé (voir api/testimonials/:id/download).
 */
export const transcribeAnswer = inngest.createFunction(
  { id: "transcribe-answer" },
  { event: "testimonial/video.ready" },
  async ({ event, step }) => {
    const { videoAssetId } = event.data as { videoAssetId: string };

    const videoAsset = await step.run("load-video-asset", () =>
      prisma.videoAsset.findUniqueOrThrow({
        where: { id: videoAssetId },
        include: { testimonialAnswer: { include: { question: true } } },
      }),
    );

    const internalDownload = await step.run("enable-internal-mp4", () =>
      enableMp4Download(videoAsset.externalUid),
    );

    const transcript = await step.run("transcribe", () =>
      transcribeVideo(internalDownload.url),
    );

    const minDuration = videoAsset.testimonialAnswer.question.minDurationSeconds;
    const duration = videoAsset.durationSeconds ?? 0;
    const qualityCheckPassed =
      duration >= minDuration && transcript.trim().length > 0;

    await step.run("save-transcript", () =>
      prisma.testimonialAnswer.update({
        where: { id: videoAsset.testimonialAnswerId },
        data: { transcriptText: transcript, qualityCheckPassed },
      }),
    );

    const testimonialId = await step.run("get-testimonial-id", async () => {
      const answer = await prisma.testimonialAnswer.findUniqueOrThrow({
        where: { id: videoAsset.testimonialAnswerId },
        select: { testimonialId: true },
      });
      return answer.testimonialId;
    });

    const remainingUntranscribed = await step.run(
      "count-remaining-answers",
      () =>
        prisma.testimonialAnswer.count({
          where: { testimonialId, transcriptText: null },
        }),
    );

    if (remainingUntranscribed === 0) {
      await step.sendEvent("trigger-synthesis", {
        name: "testimonial/answers.transcribed",
        data: { testimonialId },
      });
    }
  },
);
