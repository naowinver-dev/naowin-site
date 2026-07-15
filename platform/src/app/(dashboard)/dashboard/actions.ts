"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/tokens";
import { enableMp4Download } from "@/lib/cloudflare-stream";
import { reportDownloadUsage } from "@/lib/stripe";

const CAPTURE_LINK_TTL_DAYS = 7;

export async function publishTestimonial(testimonialId: string) {
  const companyUser = await requireCompanyUser();
  await prisma.testimonial.updateMany({
    where: { id: testimonialId, companyId: companyUser.companyId },
    data: { status: "PUBLISHED", publishedAt: new Date(), archivedAt: null, archivedReason: null },
  });
  revalidatePath("/dashboard");
}

/**
 * Archiver = retirer de la publication. Le motif ne doit porter que sur la
 * qualité technique (son inaudible, hors-sujet) — jamais sur le caractère
 * négatif du témoignage.
 */
export async function archiveTestimonial(testimonialId: string, reason: string) {
  const companyUser = await requireCompanyUser();
  await prisma.testimonial.updateMany({
    where: { id: testimonialId, companyId: companyUser.companyId },
    data: { status: "ARCHIVED", archivedAt: new Date(), archivedReason: reason },
  });
  revalidatePath("/dashboard");
}

/**
 * Débloque le téléchargement HD + synthèse. Événement facturable : reporté
 * au meter Stripe, la tarification par palier s'applique côté Stripe.
 */
export async function requestDownload(testimonialId: string) {
  const companyUser = await requireCompanyUser();

  const testimonial = await prisma.testimonial.findFirstOrThrow({
    where: { id: testimonialId, companyId: companyUser.companyId },
    include: { answers: { include: { videoAsset: true } } },
  });

  const billingAccount = await prisma.billingAccount.findUniqueOrThrow({
    where: { companyId: companyUser.companyId },
  });
  if (!billingAccount.stripeCustomerId) {
    throw new Error("Compte de facturation non configuré pour cette entreprise.");
  }

  const billingMonth = new Date().toISOString().slice(0, 7);
  const tier = await prisma.pricingTier.findFirst({
    where: {
      OR: [{ companyId: companyUser.companyId }, { companyId: null }],
    },
    orderBy: { minVolume: "desc" },
  });
  const unitPriceCents = tier?.unitPriceCents ?? 500;

  const usageEvent = await reportDownloadUsage({
    stripeCustomerId: billingAccount.stripeCustomerId,
  });

  await prisma.download.create({
    data: {
      testimonialId,
      companyId: companyUser.companyId,
      companyUserId: companyUser.id,
      unitPriceCents,
      billingMonth,
      stripeUsageEventId: usageEvent.identifier,
    },
  });

  const downloadUrls = await Promise.all(
    testimonial.answers
      .filter((a) => a.videoAsset)
      .map(async (a) => ({
        questionId: a.questionId,
        ...(await enableMp4Download(a.videoAsset!.externalUid)),
      })),
  );

  revalidatePath("/dashboard");
  return { downloadUrls, synthesisText: testimonial.synthesisText };
}

export async function createQuestion(formData: FormData) {
  const companyUser = await requireCompanyUser();
  const phase = String(formData.get("phase"));
  const promptText = String(formData.get("promptText") ?? "").trim();
  if (!promptText) throw new Error("Le texte de la question est requis");

  const count = await prisma.question.count({ where: { companyId: companyUser.companyId } });

  await prisma.question.create({
    data: {
      companyId: companyUser.companyId,
      phase: phase as "PROBLEM" | "EXPERIENCE" | "RESULT" | "RECOMMENDATION",
      promptText,
      orderIndex: count,
    },
  });
  revalidatePath("/dashboard/questions");
}

/**
 * Éditer = créer une nouvelle version active et désactiver l'ancienne, pour
 * que les témoignages déjà collectés restent liés à la question telle
 * qu'elle était posée.
 */
export async function updateQuestion(questionId: string, promptText: string) {
  const companyUser = await requireCompanyUser();
  const original = await prisma.question.findFirstOrThrow({
    where: { id: questionId, companyId: companyUser.companyId },
  });

  await prisma.$transaction([
    prisma.question.update({ where: { id: original.id }, data: { active: false } }),
    prisma.question.create({
      data: {
        companyId: companyUser.companyId,
        phase: original.phase,
        promptText,
        orderIndex: original.orderIndex,
        minDurationSeconds: original.minDurationSeconds,
      },
    }),
  ]);
  revalidatePath("/dashboard/questions");
}

export async function createCaptureLink(clientName: string | null) {
  const companyUser = await requireCompanyUser();
  const session = await prisma.captureSession.create({
    data: {
      companyId: companyUser.companyId,
      token: generateToken(),
      clientName: clientName || null,
      expiresAt: new Date(Date.now() + CAPTURE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  revalidatePath("/dashboard/links");
  return session;
}
