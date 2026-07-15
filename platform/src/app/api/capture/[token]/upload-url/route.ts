import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaptureSessionError, loadActiveCaptureSession } from "@/lib/capture-session";
import { createDirectUploadUrl } from "@/lib/cloudflare-stream";

const MAX_ANSWER_DURATION_SECONDS = 180;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const session = await loadActiveCaptureSession(token);
    const { questionId } = (await req.json()) as { questionId: string };

    const testimonial = await prisma.testimonial.findUnique({
      where: { captureSessionId: session.id },
    });
    if (!testimonial) {
      return NextResponse.json({ error: "Consentement requis" }, { status: 409 });
    }

    const question = await prisma.question.findFirst({
      where: { id: questionId, companyId: session.companyId, active: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Question invalide" }, { status: 404 });
    }

    const answer = await prisma.testimonialAnswer.upsert({
      where: { testimonialId_questionId: { testimonialId: testimonial.id, questionId } },
      update: { retakeCount: { increment: 1 } },
      create: { testimonialId: testimonial.id, questionId },
    });

    const { uploadUrl, uid } = await createDirectUploadUrl({
      maxDurationSeconds: MAX_ANSWER_DURATION_SECONDS,
      metadata: { testimonialAnswerId: answer.id },
    });

    await prisma.videoAsset.upsert({
      where: { testimonialAnswerId: answer.id },
      update: { externalUid: uid, status: "UPLOADING", watermarkApplied: false },
      create: { testimonialAnswerId: answer.id, externalUid: uid },
    });

    return NextResponse.json({ answerId: answer.id, uploadUrl });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
