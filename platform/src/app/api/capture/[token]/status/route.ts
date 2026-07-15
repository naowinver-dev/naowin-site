import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaptureSessionError, loadActiveCaptureSession } from "@/lib/capture-session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const session = await loadActiveCaptureSession(token);

    const testimonial = await prisma.testimonial.findUnique({
      where: { captureSessionId: session.id },
      include: {
        answers: {
          include: { question: true },
          orderBy: { question: { orderIndex: "asc" } },
        },
      },
    });

    if (!testimonial) {
      return NextResponse.json({ error: "Consentement requis" }, { status: 409 });
    }

    const allAnswered = testimonial.answers.every((a) => a.transcriptText !== null);
    const ready = allAnswered && testimonial.synthesisText !== null;

    return NextResponse.json({
      ready,
      synthesisText: testimonial.synthesisText,
      answers: testimonial.answers.map((a) => ({
        id: a.id,
        phase: a.question.phase,
        question: a.question.promptText,
        transcript: a.transcriptText,
        qualityCheckPassed: a.qualityCheckPassed,
      })),
    });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
