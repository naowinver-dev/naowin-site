import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaptureSessionError, loadActiveCaptureSession } from "@/lib/capture-session";

/**
 * Enregistre le consentement RGPD / droit à l'image et crée le
 * Testimonial associé à la session. Idempotent : si un Testimonial existe
 * déjà pour cette session, le renvoie tel quel.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const session = await loadActiveCaptureSession(token);

    const existing = await prisma.testimonial.findUnique({
      where: { captureSessionId: session.id },
    });
    if (existing) {
      return NextResponse.json({ testimonialId: existing.id });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const consentTextVersion = Number(process.env.CONSENT_TEXT_VERSION ?? "1");

    const testimonial = await prisma.$transaction(async (tx) => {
      const created = await tx.testimonial.create({
        data: {
          captureSessionId: session.id,
          companyId: session.companyId,
          status: "DRAFT",
          consentGivenAt: new Date(),
          consentIp: ip,
          consentTextVersion,
        },
      });
      await tx.captureSession.update({
        where: { id: session.id },
        data: { status: "IN_PROGRESS" },
      });
      return created;
    });

    return NextResponse.json({ testimonialId: testimonial.id });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
