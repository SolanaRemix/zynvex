import crypto from "node:crypto";

export function generateApiKey() {
  const raw = `zvx_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = raw.slice(0, 12);
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, keyPrefix, keyHash };
}
