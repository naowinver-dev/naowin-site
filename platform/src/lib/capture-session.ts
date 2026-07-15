import { prisma } from "@/lib/prisma";
import type { CaptureSession } from "@prisma/client";

export class CaptureSessionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Charge une session de capture par token et vérifie qu'elle est encore
 * exploitable (non expirée, non déjà terminée). Marque automatiquement en
 * EXPIRED les sessions dont l'échéance est dépassée.
 */
export async function loadActiveCaptureSession(
  token: string,
): Promise<CaptureSession & { company: { id: string; name: string; logoUrl: string | null; brandColor: string | null } }> {
  const session = await prisma.captureSession.findUnique({
    where: { token },
    include: { company: { select: { id: true, name: true, logoUrl: true, brandColor: true } } },
  });

  if (!session) throw new CaptureSessionError("Lien invalide", 404);

  if (session.expiresAt < new Date() && session.status !== "COMPLETED") {
    if (session.status !== "EXPIRED") {
      await prisma.captureSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
    }
    throw new CaptureSessionError("Ce lien a expiré", 410);
  }

  if (session.status === "COMPLETED") {
    throw new CaptureSessionError("Ce témoignage a déjà été soumis", 409);
  }

  return session;
}
