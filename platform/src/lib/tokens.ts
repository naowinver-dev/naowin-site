import crypto from "node:crypto";

export function generateToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function generateRewardCode(): string {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `MERCI-${random}`;
}
