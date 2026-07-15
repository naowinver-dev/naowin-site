import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaptureSessionError, loadActiveCaptureSession } from "@/lib/capture-session";

/**
 * Enregistre la durée mesurée côté client juste après l'enregistrement,
 * pour un affichage immédiat côté UI. La durée faisant foi reste celle
 * renvoyée par Cloudflare Stream via le webhook (VideoAsset.durationSeconds).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; answerId: string }> },
) {
  try {
    const { token, answerId } = await params;
    const session = await loadActiveCaptureSession(token);
    const { durationSeconds } = (await req.json()) as { durationSeconds: number };

    const answer = await prisma.testimonialAnswer.findFirst({
      where: {
        id: answerId,
        testimonial: { captureSessionId: session.id },
      },
    });
    if (!answer) {
      return NextResponse.json({ error: "Réponse introuvable" }, { status: 404 });
    }

    await prisma.testimonialAnswer.update({
      where: { id: answer.id },
      data: { durationSeconds: Math.round(durationSeconds) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
