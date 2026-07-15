import crypto from "node:crypto";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN!;
const WATERMARK_UID = process.env.CLOUDFLARE_WATERMARK_UID;

const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`;

async function cfFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(
      `Cloudflare Stream API error (${path}): ${JSON.stringify(body.errors ?? body)}`,
    );
  }
  return body.result as T;
}

/**
 * Génère une URL d'upload direct à usage unique : le navigateur du client
 * final envoie sa vidéo directement à Cloudflare, sans transiter par notre
 * serveur. requireSignedURLs=true empêche toute lecture publique non signée.
 */
export async function createDirectUploadUrl(params: {
  maxDurationSeconds: number;
  metadata?: Record<string, string>;
}): Promise<{ uploadUrl: string; uid: string }> {
  const result = await cfFetch<{ uploadURL: string; uid: string }>(
    "/direct_upload",
    {
      method: "POST",
      body: JSON.stringify({
        maxDurationSeconds: params.maxDurationSeconds,
        expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        requireSignedURLs: true,
        watermark: WATERMARK_UID ? { uid: WATERMARK_UID } : undefined,
        meta: params.metadata,
      }),
    },
  );
  return { uploadUrl: result.uploadURL, uid: result.uid };
}

export async function getVideoDetails(uid: string) {
  return cfFetch<{
    uid: string;
    status: { state: "pending" | "downloading" | "queued" | "inprogress" | "ready" | "error" };
    duration: number;
    playback: { hls: string; dash: string };
    readyToStream: boolean;
  }>(`/${uid}`);
}

/**
 * Crée un token de lecture signé à durée de vie limitée. Le player du
 * back-office doit en demander un nouveau à chaque affichage.
 */
export async function createSignedPlaybackToken(
  uid: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const result = await cfFetch<{ token: string }>(`/${uid}/token`, {
    method: "POST",
    body: JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    }),
  });
  return result.token;
}

export function signedHlsUrl(token: string): string {
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  return `https://customer-${customerCode}.cloudflarestream.com/${token}/manifest/video.m3u8`;
}

/**
 * Débloque le rendu MP4 téléchargeable — à appeler uniquement après
 * confirmation du paiement/facturation du téléchargement.
 */
export async function enableMp4Download(
  uid: string,
): Promise<{ url: string; status: string }> {
  const result = await cfFetch<{ default: { url: string; status: string } }>(
    `/${uid}/downloads`,
    { method: "POST" },
  );
  return result.default;
}

export async function deleteVideo(uid: string): Promise<void> {
  await cfFetch(`/${uid}`, { method: "DELETE" });
}

/**
 * Vérifie la signature HMAC-SHA256 du webhook Cloudflare Stream
 * (header `Webhook-Signature`, format `time=<ts>,sig1=<hex>`).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  if (!parts.time || !parts.sig1) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parts.time}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.sig1));
}
