import crypto from "node:crypto";

export function sha1Digest(value, length = 40) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, length);
}

export function createSha1Id(prefix, key, length = 14) {
  const digest = sha1Digest(key, length);
  return `${prefix}_${digest}`;
}
