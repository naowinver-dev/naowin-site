import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { deleteVideo } from "@/lib/cloudflare-stream";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS_UNDOWNLOADED ?? "90");

/**
 * Purge quotidienne : supprime le fichier vidéo (pas les métadonnées ni la
 * synthèse) des témoignages jamais téléchargés au-delà du délai de
 * rétention, pour maîtriser le coût de stockage.
 */
export const retentionCleanup = inngest.createFunction(
  { id: "retention-cleanup" },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const staleAssets = await step.run("find-stale-assets", () =>
      prisma.videoAsset.findMany({
        where: {
          deletedAt: null,
          createdAt: { lt: cutoff },
          testimonialAnswer: {
            testimonial: { downloads: { none: {} } },
          },
        },
        select: { id: true, externalUid: true },
      }),
    );

    for (const asset of staleAssets) {
      await step.run(`delete-${asset.id}`, async () => {
        await deleteVideo(asset.externalUid);
        await prisma.videoAsset.update({
          where: { id: asset.id },
          data: { deletedAt: new Date() },
        });
      });
    }

    return { deletedCount: staleAssets.length };
  },
);
