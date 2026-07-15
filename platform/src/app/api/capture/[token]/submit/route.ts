import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaptureSessionError, loadActiveCaptureSession } from "@/lib/capture-session";
import { generateRewardCode } from "@/lib/tokens";

const REWARD_EXPIRY_DAYS = 90;

/**
 * Le client valide son témoignage. La récompense est générée
 * immédiatement et n'est conditionnée à aucune décision de l'entreprise —
 * uniquement à la participation du client.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const session = await loadActiveCaptureSession(token);

    const testimonial = await prisma.testimonial.findUnique({
      where: { captureSessionId: session.id },
    });
    if (!testimonial) {
      return NextResponse.json({ error: "Consentement requis" }, { status: 409 });
    }
    if (testimonial.synthesisText === null) {
      return NextResponse.json(
        { error: "La synthèse n'est pas encore prête" },
        { status: 409 },
      );
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: session.companyId },
    });

    const reward = await prisma.$transaction(async (tx) => {
      await tx.testimonial.update({
        where: { id: testimonial.id },
        data: { status: "COLLECTED" },
      });
      await tx.captureSession.update({
        where: { id: session.id },
        data: { status: "COMPLETED" },
      });
      return tx.rewardCode.create({
        data: {
          captureSessionId: session.id,
          companyId: session.companyId,
          code: generateRewardCode(),
          type: company.rewardType ?? "PERCENTAGE",
          value: company.rewardValue ?? 10,
          expiresAt: new Date(Date.now() + REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        },
      });
    });

    return NextResponse.json({
      code: reward.code,
      type: reward.type,
      value: reward.value,
      expiresAt: reward.expiresAt,
    });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
