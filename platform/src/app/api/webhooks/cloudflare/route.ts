import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/cloudflare-stream";
import { inngest } from "@/lib/inngest/client";

interface CloudflareStreamWebhookBody {
  uid: string;
  status: { state: string };
  duration: number;
  readyToStream: boolean;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("webhook-signature");
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET!;

  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as CloudflareStreamWebhookBody;

  const videoAsset = await prisma.videoAsset.findUnique({
    where: { externalUid: body.uid },
  });
  if (!videoAsset) {
    // Vidéo hors du périmètre de cette plateforme (ne devrait pas arriver) — accusé de réception silencieux.
    return NextResponse.json({ ok: true });
  }

  if (body.status.state === "error") {
    await prisma.videoAsset.update({
      where: { id: videoAsset.id },
      data: { status: "ERROR" },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.readyToStream) {
    return NextResponse.json({ ok: true });
  }

  await prisma.videoAsset.update({
    where: { id: videoAsset.id },
    data: {
      status: "READY",
      durationSeconds: Math.round(body.duration),
      watermarkApplied: Boolean(process.env.CLOUDFLARE_WATERMARK_UID),
    },
  });

  await inngest.send({
    name: "testimonial/video.ready",
    data: { videoAssetId: videoAsset.id },
  });

  return NextResponse.json({ ok: true });
}
