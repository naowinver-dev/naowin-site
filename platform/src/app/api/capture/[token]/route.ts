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

    const questions = await prisma.question.findMany({
      where: { companyId: session.companyId, active: true },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        phase: true,
        promptText: true,
        minDurationSeconds: true,
        orderIndex: true,
      },
    });

    return NextResponse.json({
      status: session.status,
      company: session.company,
      questions,
      consentTextVersion: Number(process.env.CONSENT_TEXT_VERSION ?? "1"),
    });
  } catch (err) {
    if (err instanceof CaptureSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
