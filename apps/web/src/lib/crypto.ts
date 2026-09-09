import crypto from "node:crypto";
import { ApiError } from "./errors";

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError("NOT_CONFIGURED", 500, "AUTH_SECRET must be configured");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(cipherText: string) {
  const [iv, authTag, encrypted] = cipherText.split(".");
  if (!iv || !authTag || !encrypted) throw new ApiError("BAD_REQUEST", 500, "Invalid encrypted secret format");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function signPayload(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHash(secret: string, expectedHash: string) {
  const actual = sha256(secret);
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}
