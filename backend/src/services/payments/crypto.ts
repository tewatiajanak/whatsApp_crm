import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { config } from "../../config";

/**
 * Gateway secrets (salts, API secrets, webhook secrets) are encrypted at rest
 * with AES-256-GCM. The key comes from PAYMENT_ENCRYPTION_KEY; without it we
 * fall back to a key derived from JWT_SECRET so development still works.
 */
const key = (): Buffer => createHash("sha256").update(config.paymentEncryptionKey || config.jwtSecret).digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, data] = String(stored || "").split(":");
  if (v !== "v1" || !iv || !tag || !data) return "";
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

/** What the UI is allowed to see of a stored secret. */
export const maskSecret = (plain: string): string => (plain ? `••••••${plain.slice(-4)}` : "");
